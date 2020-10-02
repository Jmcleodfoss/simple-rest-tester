# simple-rest-tester
A simplistic mocha-based test harness for REST APIs which uses [node.js](http://nodejs.org), [Mocha](http://mochajs.node), and [Chai.js](www.chaijs.com) to run simple REST API tests with the following structure:
* a deterministic return value
* a response code

## Installation
```
npm install simple-rest-tester --save-dev
```
## JSON structure
The test information is stored in a json file with the following members:
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
e.g. POST_myservice_200.json.

## Running Tests
Create a test suite using a file like [examples/test.js](https://github.com/Jmcleodfoss/simple-rest-tester/blob/master/examples/test.js):
```
"use strict";

const mocha_test = require('simple-rest-tester').mocha;

function test(jsonFile)
{
	var reqDescr = require(jsonFile);

	try {
		mocha_test(reqDescr);
	} catch (ex) {
		console.log(ex);
	}
}

// Order of tests is important if you are using macros ore relying on the existence of resources created by earlier tests in later tests
test('./GET_ping_204.json')
test('./POST_service_200.json')
test('./POST_service_400.json')
// etc
```
Invoke *mocha* in the directory containing the above script to run the tests.

## Macros
Within a given run of a suite of tests, it is possible to save information returned in one test for use in a later test, for example,
saving the returned item index from a POST request to use in a DELETE, GET, or PUT request. Macros may appear in any string value in
the test object, although they are most useful in the `path` and `payload` values.

### Saving Data
To save the response from a test, the following elements need to be defined in the test object:
* `saveResponse: true`
* `testname: /* A unique name for the test, e.g. POST_tag_200 */`

The test must return an object like `{"addedItemIndex":"193"}`.

### Referring to Saved Data
To refer to saved information in a later test, use a macro with the format `${saved-testname}.member`, e.g. `${POST_item_200}.addedItemIndex`. 
All occurrences of this macro will be replaced with the value returned by the named test.
A path containing a macro (in the `options` structure):
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
You may also add macros programatically using the `addMacros` function:
```
"use strict";

const srt = require('simple-rest-tester');

srt.addMacro('user-defined', 'User-defined macro goes here.');
srt.addMacro('timestamp', new Date().getTime());
```
This will result in any occurences of `${user-defined}` being replaced by the string "User-defined macro goes here.", and `${timestamp}` being replaced by the timestamped 
grabbed by node when the program was executed.

## Debugging
Basic logging to console of the path, payload, status code, and response, is available by setting the environment variable `SRT_TEST=1`

## Releases
### 1.0.0
Initial release. Functionality to be improved as demand requires and time permits.
