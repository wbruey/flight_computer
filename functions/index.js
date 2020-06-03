const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
//const request = require('request');
const language = require('@google-cloud/language');
const cors = require('cors')({
  origin: true,
});
var twilio = require('twilio');
var http = require('http');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const readline = require('readline');
const {google} = require('googleapis');
const request = require('request-promise');




//=======TEXT WILL TOTAL MAINTENACE SUMMARY===============
exports.text_maintenance_summary = functions.pubsub.schedule('every 2 minutes').onRun((context) => { 
	//define the phone number to send the text too.
	var phone = '7174756561';
	var console_message='';
    //grab the time - based maintence items
	const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});
	sheets.spreadsheets.values.get({
		spreadsheetId: '1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0',
		range: 'routine_time!B1:C2',
	}, (err, res) => {
	if (err) return console.log('The API returned an error: ' + err);
	const rows = res.data.values;
	console.log(rows);
	console.log(rows[0]);
	if (rows.length) {
	  console_message='Today is ' + rows[0][0] + ' '+ rows[0][1] + '. You have ' + rows[1][1] + ' days left until you are late on plane maintence.';
	  console.log(console_message);
	  // Print columns A and E, which correspond to indices 0 and 4.
	} else {
	  console.log('No data found.');
	}
	});
	
	
	//define the client object for a twilio client
	const client = require('twilio')(functions.config().twilio_auth.account_sid, functions.config().twilio_auth.auth_token);

	//create a message object
	client.messages.create(
	  {
		to: '+1'+phone,
		from: '+17176960783', // this is my twilio number
		body: console_message,  // this the text in the sms message
	  },
	  function(err,message){  // if there is a return message from twilio grab it. 
		  if(err){
			  console.log(err);  //if there is an error in that message, log it .
		  }else{
			  console.log(message.sid);  //  otherwise log the message anyway
		  }
	  }
	);
	
	return(0);
});



//=======get and print user info to console===============
exports.list_users = functions.pubsub.schedule('every 23 hours').onRun((context) => { 

	admin.auth().updateUser('cpIxtybEjuYwKGREJFJLWTHhvtZ2', {
	  phoneNumber: '+17174756561'
	})
	  .then(function(userRecord) {
		// See the UserRecord reference doc for the contents of userRecord.
		console.log('Successfully updated user', userRecord.toJSON());
	  })
	  .catch(function(error) {
		console.log('Error updating user:', error);
	  });


	function listAllUsers(nextPageToken) {
	  // List batch of users, 1000 at a time.
	  admin.auth().listUsers(1000, nextPageToken)
		.then(function(listUsersResult) {
		  listUsersResult.users.forEach(function(userRecord) {
			console.log('user', userRecord.toJSON());
		  });
		  if (listUsersResult.pageToken) {
			// List next batch of users.
			listAllUsers(listUsersResult.pageToken);
		  }
		})
		.catch(function(error) {
		  console.log('Error listing users:', error);
		});
	}
	// Start listing users from the beginning, 1000 at a time.
	listAllUsers();

});


//==========GRAB A VALUE from the google spreadsheet and post it to console log. test function =====================================

exports.grab_log_cell = functions.pubsub.schedule('every 23 hours').onRun((context) => { 

	//function listMajors(auth) {
	  const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});
	  sheets.spreadsheets.values.get({
		spreadsheetId: '1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0',
		range: 'Routine!A9:B13',
	  }, (err, res) => {
		if (err) return console.log('The API returned an error: ' + err);
		const rows = res.data.values;
		if (rows.length) {
		  console.log('Item, Interval:');
		  // Print columns A and E, which correspond to indices 0 and 4.
		  rows.map((row) => {
			console.log(`${row[0]}, ${row[1]}`);
		  });
		} else {
		  console.log('No data found.');
		}
	  });
	//}
	return(0);
});


//===========SEND A TEXT _ TEST FUNCTION======================================================================
// sends a text per schedule below.
// define the schedule
exports.test_text = functions.pubsub.schedule('every 23 hours').onRun((context) => { 
	//define the phone number to send the text too.
	var phone = '7174756561';
  	
	//define the client object for a twilio client
	const client = require('twilio')(functions.config().twilio_auth.account_sid, functions.config().twilio_auth.auth_token);

	//create a message object
	client.messages.create(
	  {
		to: '+1'+phone,
		from: '+17176960783', // this is my twilio number
		body: 'airplane!',  // this the text in the sms message
	  },
	  function(err,message){  // if there is a return message from twilio grab it. 
		  if(err){
			  console.log(err);  //if there is an error in that message, log it .
		  }else{
			  console.log(message.sid);  //  otherwise log the message anyway
		  }
	  }
	);
	return(0);
});
