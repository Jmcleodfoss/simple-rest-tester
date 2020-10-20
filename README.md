![MIT License](https://img.shields.io/badge/license-MIT-green)![Xanitizer Security Analysis](https://github.com/Jmcleodfoss/simple-rest-tester/workflows/Xanitizer%20Security%20Analysis/badge.svg)![SL Scan](https://github.com/Jmcleodfoss/simple-rest-tester/workflows/SL%20Scan/badge.svg)![Codacy Security Scan](https://github.com/Jmcleodfoss/simple-rest-tester/workflows/Codacy%20Security%20Scan/badge.svg)![CodeQL](https://github.com/Jmcleodfoss/simple-rest-tester/workflows/CodeQL/badge.svg)
# simple-rest-tester
A simplistic test harness for REST APIs which uses [node.js](http://nodejs.org), [Mocha](http://mochajs.node), and [Chai.js](www.chaijs.com), and JSON files defining test parameters 
and expected results to run simple REST API tests with the following characteristics:
* a deterministic return value
* a response code
The *simple-rest-tester* package includes three applications:
* simple-rest-tester, which runs tests on all JSON files in the current directory, handling dependencies (for tests which use the results of other tests)
* srt-generator, which creates test JSON files from an [OpenAPI 3](https://swagger.io/specification/) specification with a small number of vendor extensions described below
* srt-expand-macros, which allows you to show what a test file looks like after macro replacement for macros defined at the command line and using environment variables
There is also an API for use if your testing needs are more complicated than what can be handled by the *simple-rest-tester* application (for example, you need to run tests in a 
specific order different from that used by the provided application).

## Installation
### For Command-Line Use
To use the three applications from the command line, install using npm with the -g / --global flag:
```
npm install -g simple-rest-tester
```
### To Use the simple-rest-tester Engine Directly
```
npm install simple-rest-tester
```

## JSON structure
The test information is stored in a JSON file with the following members:
```
{
	"description": /* Description of the test to be displayed by Mocha */
	"expectation": /* Description of the results of a successful test to be displayed by Mocha */
	"status": /* Expected numeric HTTP status code, used by a Mocha expect test"
	"responseRegexp": /* A regular expression describing the expected response, used by a Mocha expect test (e.g. 200, 204, 400, 401, 404, etc) */
	"saveResponse": /* A flag indicating whether the result of this test should be saved for later use by another test in the test suite (true or false) */
	"testname": /* Unique (within test suite) identifier */
	"scheme": /* the URL scheme to use for this test (http or https) */

	"payload": /* An object giving the contents of the body of a POST or PUT request, if any */

	"options": {
		"host": /* The name or IP address of the host holding the REST API server to be tested */
		"port": /* The port the REST API server is listening on */
		"path": /* The path of the REST API endpoint to be tested */
		"method": /* The HTTP method (POST, GET, PUT, DELETE, etc) */
		"headers": /* An object providing any HTTP headers, e.g. "accept": "application/json" or "Content-Type": "application/json" */
		}
	}
}
```
* The value of `description` is passed to the Mocha`describe` function.
* The value `expectation` is passed to the Mocha`i` function.
* The value of `status` is compared to the status code of the service's response to the request in a Chai.js`expec` test.
* The value of `responseRequest` is compared to the string returned by the service to the rest request in a Chai.js`expec` test.
* The value of `saveResponse` indicates whether the response from the server to this request should be saved for use in a future test. See "macros" below for more information.
* The value of `testname` is used in macros to refer to returned results in later tests. See "macros" below for more information. It is only necessary if saveResponse is true. By convention, it has the format METHOD_service_response, e.g. POST_myservice_200.
* The value of `scheme` is used with a`require` command to create an http or https object.
* The value of `payload` is written into the POST or PUT request.
* The `options` object is the passed into the [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback) or
[https.request](https://nodejs.org/api/https.html#https_https_request_options_callback) function.

## Test File Names
By convention, the base file name is the same as the testname member, with the extension "json": METHOD_service_response.json, 
e.g. POST_myservice_200.json, but you may pick whatever convention you like.

## Creating Tests from an OpenAPI Specification: srt-generator
### Running srt-generator
`srt-generator [--help|-h] | [--overwrite|-O] [--quiet|-q] [--server=#|-s #] openapi.yaml-1 [openapi.yaml-2 ...]`
where
* -h / --help: shows command help
* -O / --overwrite: overwrites all existing files without asking
* -q / --quiet: suppresses informational messages about which files are being over-written, etc
* -s # / --server=#: pull scheme, host, and port from the definition for server index `#` instead of from server index 0

### Standard Elements Used
* `servers[0]`: used to find the scheme, hostname, port, and path prefix, if any.
* `paths.path`: used to create the `testname` member, the filename, the test description, and the URL `path` member for the http/https `options` object.
* `paths.path.method`: used to create the `testname` member, the filename, and the `method` member of the http/https `options` object.
* `paths.path.method.requestBody.content.application/json.examples`: used for the payload and as a suffix for the filename for POST and PUT requests.
* `paths.method.responses.response`: used for the expected returned status from the server

### Vendor Extensions
The OpenAPI specification does not include quite enough information to make tests useful. The vendor extension element `x-srt` allows srt-generator to create tests which are more than just stubs that need to be filled in.
The x-srt element allows any element of the JSON test file to be set, overriding the values that *srt-generator* by default pulls out of the spec file. This is a powerful feature, but can also lead to problems which may
be difficult to debug. In general, a test will need to define the `description`, `expectation`, `response-regexp`, `path-suffix` and `path-subst` members here, but you may find the default values are suitable in some cases.

#### Caveat
It goes without saying that you should not put authentication credentials into your OpenAPI spec file for testing. Use the environment macro facility described below if you need to perform tests requiring authentication.

#### paths.path.method.responses.response.x-srt/description
This provides the `description` member of the test object.

#### paths.path.method.responses.response.x-srt/expectation
This extension is used to provide the `expectation` member of the test object.

#### paths.path.method.responses.response.x-srt.response-regexp
This provides a regexp matching the expected response from the server. If it is not present, all responses are considered matches.

#### paths.path.method.responses.response.x-srt.path-suffix
This extension is used to build the `path` member of the test object.

#### paths.path.method.responses.response.x-srt.skip-test
This extension may be used with responses for which no test case is desired, Starting with version 1.0.1, this is unnecessary as no
tests will be generated for responses with no x-srt member, but it remains and is not deprecated for those who choose to distinguish
between responses which have not been considered and those which have been explicitly ignored.

#### paths.path.method.responses.response.x-srt.payload
This extension should be used to provide a payload for tests which do not use the paths.path.method.requestBody.content.application/json/examples element to provide the body of a request.

#### paths.path.method.responses.response.x-srt.path-subst
This extension. if present, should be a set of key-value pairs where the key represents a part of the path to be replaced, and the value is the substituted value.

#### paths.path.method.responses.response.x-srt.scheme
This may be used to over-ride the scheme use for testing (http or https) which is by default obtained from the first defined server.

#### paths.path.method.responses.response.xsrt.options.host
This may be used to over-ride the host used for testing which is obtained from the first defined server.

### paths.path.method.responses.response.xsrt.options.port
This may be used to over-ride the port used for testing which is obtained from the first defined server.

### paths.path.method.responses.response.xsrt.options.headers
This array van be used to add header data to the options object passed to the http/https request function. The values provided here over-ride any default values for `Content-Type` or `accept`.

## Example OpenAPI Specification
An example OpenAPI specification that includes the vendor extensions described above can be found in the [examples/openapi](https://github.com/Jmcleodfoss/srt-generator/blob/master/examples/openapil) directory:
along with output JSON files srt-generator generates:
* openapi.yaml
* DELETE_point_204.json
* DELETE_point_401.json
* DELETE_point_404.json
* GET_ping_204.json
* GET_point_200.json
* GET_point_404.json
* POST_point_200_pointOrigin.json
* POST_point_400.json
* PUT_point_204_point90Degrees.json
* PUT_point_400.json
* PUT_point_401.json
* PUT_point_404.json
**Note** that generating a server using *openapi-generator* and running it, and the running mocha against these tests, will *not* result in the expected behavior for the \*40x.json files as there is no
code backing the point service to return error values.

## Running Tests: simple-rest-tester
Once you have created your test specification JSON files, either from an OpenAPI spec or manually, you can run your tests. First, start the services you are testing, then, from the directory containing the test
specification files, run
`simple-rest-tester`
The application will analyze your test specifications, attempt to determine the order in which to conduct the tests, and run Mocha.js on each defined test.

## Macros
Within a given run of a suite of tests, it is possible to save information returned in one test for use in a later test, for example, saving the returned item index from a POST request to use in a DELETE, GET, 
or PUT request. Macros may appear in any string value in the test object, although they are most useful in the `path` and `payload` values.

### Saving Responses
To save the response from a test, the following elements need to be defined in the test object:
* `saveResponse: true`
* `testname: /* A unique name for the test, e.g. POST_tag_200 */`
The test must return an object like `{"addedItemIndex":"193"}`.

### Referring to Saved Data
To refer to saved information in a later test, use a macro with the format `${saved-testname}.member`, e.g. `${POST_item_200}.addedItemIndex`. 
All occurrences of this macro will be replaced with the value returned by the named test.

Here is an example of path containing a macro (in the `options` member of the test specification):
```
"path": "/v1/item/${POST_item_200}.addedItemIndex?queryParameter=1
```
After macro replacement, this will become (using our example `addedItemIndex` from above):
```
"path": "/v1/item/193?queryParameter=1
```
Similar substitutions can take place in the payload object.

## Environment Substitutions
You may refer to environment variable values in macros of the form `${env}.ENVIRONMENT_VARIABLE_NAME}`. A very contrived example is `${emv}.PATH` will be expanded to your path.
Note (a) that case is important, and (b), if you have a test which saves results under the prefix `${env}`, it won't be picked up.

## User-Defined Macros
You may also add macros programmatically using the `addMacros` function. This functionality is not supported when running Mocha.js via the *simple-rest-tester* application because of 
complications arising from Mocha.js command line processing. These are described in more detail in the section "Rolling Your Own", below.

## Debugging
Basic logging to console of the path, payload, status code, and response, is available by setting the environment variable `SRT_TEST=1` (both when running the *simple-rest-tester* 
application and when running the simple-rest-tester engine from your own application).

## Rolling Your Own
Create a test suite using a file like [examples/test.js](https://github.com/Jmcleodfoss/simple-rest-tester/blob/master/examples/test.js):
```
"use strict";

const srt = require('simple-rest-tester');

function test(jsonFile)
{
	var reqDescr = require(jsonFile);

	try {
		srt.mocha(reqDescr);
	} catch (ex) {
		console.log(ex);
	}
}

srt.addMacro('user-defined', 'User-defined macro goes here.');
srt.addMacro('timestamp', new Date().getTime());

// Order of tests is important if you are using macros ore relying on the existence of resources created by earlier tests in later tests
test('./GET_ping_204.json')
test('./POST_service_200.json')
test('./POST_service_400.json')
// etc
```
This will result in any occurrences of `${user-defined}` in the test specification being replaced by the string "User-defined macro goes here.", and `${timestamp}` being replaced by the timestamped 
grabbed by node when the program was executed.

Invoke *mocha* in the directory containing the above script to run the tests.

## Viewing Macro Substitutions: srt-expand-macros.
For troubleshooting, it is often convenient to see how macros are expanded. This can be done using the *srt-expand-macros* application.

### Running srt-generator
`srt-expand-macros[-h | [-D macro-1=value-1 [-D macro-2=value2 [...]]] test-definition [test-definition [...]]]`
where
* -h / --help              Display this usage guide
* -D / --define string[]   Define macro as macro=substitution (this can appear multiple times)

Macros can be either response-style macros (${a}.b=value} or simple substitutions (${a}=value).

## Releases
### 1.0.1
Fix typo in homepage URL in package.json.
Add a keyword to package.json
#### srt-generator
Don't create tests for responses without an x-srt element.

### 1.0.0
Initial release. Functionality to be improved as demand requires and time permits.
