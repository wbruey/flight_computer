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

//=======LEARNING ABOUT PROMISES===============
exports.promise_test = functions.pubsub.schedule('every 60 minutes').onRun((context) => { 

	function fake_grab(text1,text2){
		functions_promise = new Promise((resolve,reject)=>{
			if(text1.length && text2.length){
				resolve(text1 +'   ' +  text2);
			}else{
				throw new Error("one of the texts is blank");
			}
		});
		return functions_promise;
	}


	const googles_promise = fake_grab('',' breast')  // define the promise
		.then((text_data) => {     //define what to do next if promise is fulfilled
			console.log(text_data);
		})
		.catch((err)=> {
			console.log(err);  //define what to do i fthe promise is not fulfilled.
			console.log('do a top level error thing');
			
		});

	setTimeout(()=>console.log('do an adjacent thing'),1000);
	
	
	
	return 0;

});

//returns a promise to grab spreadsheet data from google API given a spreadsheet ID and a range to grab data from
function grab_spreadsheet_data(spreadsheetId,range){
	//construct the promise to return
	const googles_promise = new Promise((resolve,reject)=>{
		const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});  //create a google sheets object interface object with my api key
		sheets.spreadsheets.values.get({  //use that api object to get spreadsheet data in a spreadsheet at a range
			spreadsheetId: spreadsheetId,
			range: range,
		}, (err, res) => {
			if (err){
				console.log('Google API didnt work');
				throw new Error(err);
			} else {
				const rows = res.data.values;
				if (rows.length) {
				  resolve(rows);
				} else {
				  console.log('Sheets API worked but no (blank) data found at google sheet.');
				}
			}
		});
	});	
	return googles_promise;
}

//returns a promise to send a text message and then hopefully sends it
function send_text_message(phone,text_message){
	//construct the promise to return
	const twilios_promise = new Promise((resolve,reject)=>{
		const client = require('twilio')(functions.config().twilio_auth.account_sid, functions.config().twilio_auth.auth_token); //create a client api connection object 
		client.messages.create(  //create a message and send it.
		  {
			to: '+1'+phone,
			from: '+17176960783', // this is my twilio number
			body: text_message,  // this the text in the sms message
		  },
		  function(err,message){  // if there is a return message from twilio grab it. 
			  if(err){
				  console.log('Twilio API didnt work');
				  throw new Error(err);  //if there is an error in that message, log it .
			  }else{
				  console.log('Twilio sent a text message with sid recepit: ' + message.sid);
				  resolve(message.sid);
			  }
		  }
		);	
	});
	return twilios_promise;
}



//=======TEXT WILL TOTAL MAINTENACE SUMMARY===============
exports.text_maintenance_summary2 = functions.pubsub.schedule('every 60 minutes').onRun((context) => { 
	
	//define the spreadsheet to get data from and the phone number to send the text too.
	const spreadsheetId='1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0';
	const range='routine_time!B1:C2';
	const phone = '7174756561';
	var text_message = 'error with text_maintenance_summary firebase function'; // by default the text message should say an error since it's supposed to get updated below.
	
	//get a promise to do the things (grab data and then text) then do them.
	const promise_to_text_maintenance_status = grab_spreadsheet_data(spreadsheetId,range)
		//then format the data from the spreadsheeet to create the message you want to send.  remember, youre passing a function to the .then method slot.
		.then((rows) =>{
			text_message='Today is ' + rows[0][0] + ' '+ rows[0][1] + '. You have ' + rows[1][1] + ' days left until you are late on plane maintence.';
			console.log('Text body will be: ' + text_message)
			//then return the PROMISE of a text message which will be the promise for the next THEN in the chain...
			return send_text_message(phone,text_message);
		})
		//after the promise of sending a text message has completed...
		.then(() => console.log('Successfully Updated Will with Maintenance Report'))
		//if there was an error, print it to console.
		.catch(err=>console.log('Failed to update Will with Maintenance Report:  ' + err));

	// make highest level firebase function happy
	return 0;
});


//=======TEXT WILL TOTAL MAINTENACE SUMMARY===============
exports.text_maintenance_summary = functions.pubsub.schedule('every 60 minutes').onRun((context) => { 
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
		//console.log(rows);
		//console.log(rows[0]);
		if (rows.length) {
		  console_message='Today is ' + rows[0][0] + ' '+ rows[0][1] + '. You have ' + rows[1][1] + ' days left until you are late on plane maintence.';
		  console.log(console_message);
		  // Print columns A and E, which correspond to indices 0 and 4.
		} else {
		  console_message='No data found.';
		  console.log(console_message);
		}

		//define the client object for a twilio client
		const client = require('twilio')(functions.config().twilio_auth.account_sid, functions.config().twilio_auth.auth_token);
		//console.log(functions.config().twilio_auth.account_sid);
		//console.log(functions.config().twilio_auth.auth_token);
		//create a message object
		client.messages.create(
		  {
			to: '+1'+phone,
			from: '+17176960783', // this is my twilio number
			body: console_message,  // this the text in the sms message
		  },
		  function(err,message){  // if there is a return message from twilio grab it. 
			  if(err){
				  console.log('Twilio error:');
				  console.log(err);  //if there is an error in that message, log it .
			  }else{
				  console.log('Twilio success, returned sid:');
				  console.log(message.sid);  //  otherwise log the message anyway
			  }
		  }
		);	
	});
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
