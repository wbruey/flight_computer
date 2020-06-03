const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
//const request = require('request');
const language = require('@google-cloud/language');
const cors = require('cors')({
  origin: true,
});
var twilio = require('twilio');
const twilio_accountSid = 'AC0ffe354bb1064b240f2c38ae8eef3744';
const twilio_authToken = 'f26f395b0220b4e779c68ba6540b3d7f';
var http = require('http');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const readline = require('readline');
const {google} = require('googleapis');
const request = require('request-promise');



//==========GRAB A VALUE from the google spreadsheet and post it to console log. test function =====================================

exports.grab_log_cell = functions.pubsub.schedule('every 23 hours').onRun((context) => { 
	//const fs = require('fs');


	// If modifying these scopes, delete token.json.
	const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
	// The file token.json stores the user's access and refresh tokens, and is
	// created automatically when the authorization flow completes for the first
	// time.
	//const TOKEN_PATH = 'token.json';

	// Load client secrets from a local file.
	//fs.readFile('credentials.json', (err, content) => {
	//  if (err) return console.log('Error loading client secret file:', err);
	//  // Authorize a client with credentials, then call the Google Sheets API.
	//  authorize(JSON.parse(content), listMajors);
	//});

	/**
	 * Create an OAuth2 client with the given credentials, and then execute the
	 * given callback function.
	 * @param {Object} credentials The authorization client credentials.
	 * @param {function} callback The callback to call with the authorized client.
	 */
	//function authorize(credentials, callback) {
	 // const {client_secret, client_id, redirect_uris} = functions.config().google_auth;
	 // const oAuth2Client = new google.auth.OAuth2(
		//  client_id, client_secret, redirect_uris[0]);

	  // Check if we have previously stored a token.
	  //fs.readFile(TOKEN_PATH, (err, token) => {
	//	if (err) return getNewToken(oAuth2Client, callback);
	//	oAuth2Client.setCredentials(JSON.parse(token));
	//	callback(oAuth2Client);
	//  });
	//}

	/**
	 * Get and store new token after prompting for user authorization, and then
	 * execute the given callback with the authorized OAuth2 client.
	 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
	 * @param {getEventsCallback} callback The callback for the authorized client.
	 */
/* 	function getNewToken(oAuth2Client, callback) {
	  const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	  });
	  console.log('Authorize this app by visiting this url:', authUrl);
	  const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	  });
	  rl.question('Enter the code from that page here: ', (code) => {
		rl.close();
		oAuth2Client.getToken(code, (err, token) => {
		  if (err) return console.error('Error while trying to retrieve access token', err);
		  oAuth2Client.setCredentials(token);
		  // Store the token to disk for later program executions
		  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
			if (err) return console.error(err);
			console.log('Token stored to', TOKEN_PATH);
		  });
		  callback(oAuth2Client);
		});
	  });
	} */

	/**
	 * Prints the names and majors of students in a sample spreadsheet:
	 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
	 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
	 */
	//function listMajors(auth) {
	  const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});
	  sheets.spreadsheets.values.get({
		spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
		range: 'Class Data!A2:E',
	  }, (err, res) => {
		if (err) return console.log('The API returned an error: ' + err);
		const rows = res.data.values;
		if (rows.length) {
		  console.log('Name, Major:');
		  // Print columns A and E, which correspond to indices 0 and 4.
		  rows.map((row) => {
			console.log(`${row[0]}, ${row[4]}`);
		  });
		} else {
		  console.log('No data found.');
		}
	  });
	//}
});


//===========SEND A TEXT _ TEST FUNCTION======================================================================
// sends a text per schedule below.
// define the schedule
exports.test_text = functions.pubsub.schedule('every 23 hours').onRun((context) => { 
	//define the phone number to send the text too.
	var phone = '7174756561';
  	
	//define the client object for a twilio client
	const client = require('twilio')(twilio_accountSid, twilio_authToken);

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
