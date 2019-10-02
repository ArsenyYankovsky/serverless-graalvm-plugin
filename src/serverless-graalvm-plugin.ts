import { execSync } from 'child_process'
import * as fs from 'fs'
// @ts-ignore
import lignator from 'lignator'
import Serverless from 'serverless'

export default class ServerlessPlugin {
  private serverless: Serverless
  private hooks: { 'before:package:createDeploymentArtifacts': () => Promise<void> }

  constructor(serverless: Serverless) {
    this.serverless = serverless

    this.hooks = {
      'before:package:createDeploymentArtifacts': this.processLambdas,
    }
  }

  protected processLambdas = async () => {
    await this.prepareWorkingDirectory()

    const lambdaNames = this.serverless.service.getAllFunctions()

    const shouldUseDocker = this.shouldUseDocker()

    const dockerName = `${this.serverless.service.getServiceName()}-graal`

    if (shouldUseDocker) {
      try {
        execSync(`docker rm ${dockerName} --force`, { stdio: 'ignore' })
      } catch (e) {
        // ignore all errors
      }
    }

    const resourceConfigExists = fs.existsSync('resource-config.json')

    lambdaNames.forEach((lambdaName) => {
      this.processLambda(lambdaName, dockerName, shouldUseDocker, resourceConfigExists)
    })
  }

  protected shouldUseDocker = () => {
    try {
      execSync('native-image --help', { stdio: 'ignore' })
      execSync('zip', { stdio: 'ignore' })
      return false
    } catch (e) {
      console.log('native-image or zip command not found locally, falling back to use Docker')
      return true
    }
  }

  protected prepareWorkingDirectory = async () => {
    lignator.remove('.graalvm')

    if (!fs.existsSync('.graalvm')) {
      fs.mkdirSync('.graalvm')
    }

    if (!fs.existsSync('reflect.json')) {
      throw new Error('reflect.json file not found')
    }

    fs.copyFileSync('reflect.json', '.graalvm/reflect.json')
    fs.writeFileSync('.graalvm/bootstrap', this.getBootstrapScript())

    if (fs.existsSync('resource-config.json')) {
      fs.copyFileSync('resource-config.json', '.graalvm/resource-config.json')
    }
  }

  protected processLambda = (
    lambdaName: string,
    dockerName: string,
    shouldUseDocker: boolean,
    resourceConfigExists: boolean,
  ) => {
    this.serverless.cli.log(`Compiling ${lambdaName} to native code`)

    const packagePath = this.serverless.service.getFunction(lambdaName).package.artifact!

    const clonedPackagePath = `.graalvm/${lambdaName}.jar`

    fs.copyFileSync(packagePath, clonedPackagePath)

    const workingDirectory = shouldUseDocker ? '/.graalvm' : '.graalvm'

    const buildCommand = `\
        cd ${workingDirectory} && \
        native-image --enable-url-protocols=http \
        -H:EnableURLProtocols=https \
         -Djava.net.preferIPv4Stack=true \
         ${resourceConfigExists ? '-H:ResourceConfigurationFiles=resource-config.json' : ''} \
         -H:ReflectionConfigurationFiles=reflect.json \
         -J-Xss10m \
         -J-Xms1g \
         -J-Xmx14g \
         --no-server -jar ${lambdaName}.jar && \
         mv -f ${lambdaName} server && \
         chmod 777 bootstrap && \
         zip -D -j ${lambdaName}.zip server bootstrap \
    `

    if (shouldUseDocker) {
      execSync(`docker run --rm --name ${dockerName} -v ${process.cwd()}/.graalvm:/.graalvm \
        ayankovsky/serverless-graalvm-plugin-build-image:0.0.3 \
         /bin/bash -c "${buildCommand}"`)
    } else {
      execSync(buildCommand)
    }

    this.serverless.service.getFunction(lambdaName).package = {
      artifact: `.graalvm/${lambdaName}.zip`,
      include: [],
      exclude: [],
    }
  }

  protected getBootstrapScript = () => {
    return `\
#!/bin/sh
set -euo pipefail
./server \
`
  }
}
