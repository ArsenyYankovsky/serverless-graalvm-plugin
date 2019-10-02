# serverless-graalvm-plugin

### Description
Compiles jars into native packages with GraalVM Native Image reducing cold start and improving overall performance. It relies on locally installed native-image or falls back to using a docker image to do so.

##### [Demo Project](https://github.com/ArsenyYankovsky/serverless-graalvm-plugin-test-project)

### How to use
#### Prerequisites
This plugins requires either `docker` to be installed or `native-image` and `zip`

#### Installation
Run 

```yarn add --dev serverless-graalvm-plugin```

or 

```npm i --save-dev serverless-graalvm-plugin```

#### Create runtime related classes
In order for the plugin to work you need to create runtime-related classes that will serve as a main class for your jars.

Create a runtime class for each of your lambdas. There's an [example](https://github.com/ArsenyYankovsky/serverless-graalvm-plugin-test-project/blob/master/src/main/java/com/serverless/runtime/DirectInvocationRuntime.java) of such classes in the test project

#### Build a runnable jar for each lambda
You will need to modify your build process to generate a runnable jar for each of the lambda functions in your project. Make sure you make the runtime class a main class in your jar and jar is runnable.

There's an [example](https://github.com/ArsenyYankovsky/serverless-graalvm-plugin-test-project/blob/master/build.gradle) of a gradle build configuration in the test project.

#### Modify serverless.yml file

Modify handler and runtime of your lambda functions:

```
hello-direct:
  runtime: provided
  handler: not.used
```

Point package.artifact property to your built jar:

```
hello-direct:
  runtime: provided
  handler: not.used
  package:
    artifact: build/libs/direct-invocation.jar
```

#### Create a `reflect.json` file
Create a `reflect.json` file in the root of your project which will act as a reflection configuration file for the GraalVM. 
Read more on reflection [here](https://github.com/oracle/graal/blob/master/substratevm/REFLECTION.md)

For most of the cases you just need to add your request and response classes there.

#### (Optional) create a `resource-config.json` file
To pass resource configuration to the `native-image` command create a `resource-config.json` file in the root of your project. 
Read more on the resources with GraalVM [here](https://github.com/oracle/graal/blob/master/substratevm/RESOURCES.md).

### Known Issues

#### Docker Memory

Sometimes the docker container might crash with out of memory error. Try to increase memory for the container, 4 gb should be enough.

#### CI 

With some CI providers like CircleCI it's hard to make docker commands work inside the build environment. 
You might want to install `native-image` or use a docker image based on [oracle/graalvm-ce](https://hub.docker.com/r/oracle/graalvm-ce/) instead.

#### Https Support

By default, there are some errors if you're trying to send https requests from compiled native image. This is fixed inside a docker container that is used by this docker plugin. 

If you're not running a docker container the workaround is to modify your local `java.security` 
file that is located in the `$JAVA_HOME/jre/lib/security/` directory. You need to remove the SunEC from the providers section.
