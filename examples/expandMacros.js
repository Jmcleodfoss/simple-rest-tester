"use strict";

const srt = require('simple-rest-tester');

function test(jsonFile)
{
	try {
		const reqDescr = require(jsonFile);
		console.log(srt.applyMacros(reqDescr));
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
test('./GET_service_200.json')
// etc
