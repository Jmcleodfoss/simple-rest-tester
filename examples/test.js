"use strict";

const mocha_test = require('simple-rest-tester').mocha;

function test(jsonFile)
{
	const reqDescr = require(jsonFile);
	mocha_test(reqDescr);
}

// Order of tests is important if you are using macros ore relying on the existence of resources created by earlier tests in later tests
test('./GET_ping_204.json');
test('./POST_service_200.json');
test('./POST_service_400.json');
// etc
