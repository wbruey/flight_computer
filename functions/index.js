const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
//const request = require('request');
const language = require('@google-cloud/language');
const cors = require('cors')({origin:true});
var twilio = require('twilio');
var http = require('http');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const readline = require('readline');
const {google} = require('googleapis');
const request = require('request-promise');
const nodemailer = require('nodemailer');



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

//sends an email
function send_email(to,from,subject,html){
	const mailOptions = {
		to:to,
		from:from,
		subject:subject,
		html:html
	}
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user:functions.config().gmail_auth.address,
			pass:functions.config().gmail_auth.password
		}
	});
	transporter.sendMail(mailOptions,(err, info) => {
		if(err){
			console.log('Error sending email to '+ err.toString());
			throw new Error(err);
		}else{
			console.log('Sent an email:  ' + info);
		}
	});
	return 0;
}



//=======EMAIL WILL TOTAL MAINTENACE SUMMARY===============
exports.email_maintenance_summary = functions.pubsub.schedule('every 5 days').onRun((context) => { 
	
	//first get the maintenance report
	const time_spreadsheetId='1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0';
	const header_range='routine_time!B1:C2';
	const time_data_range='routine_time!A7:D';
	
	var html='<p>ERROR</p>';
	var todays_date='error';
	
	//get a promise to do the things (grab data and then email) then do them.
	const promise_grab_maintenance = grab_spreadsheet_data(time_spreadsheetId,header_range)
		//then format the data from the spreadsheeet to create the message you want to send.  remember, youre passing a function to the .then method slot.
		.then((rows) =>{
			console.log('Mainteance data gathered: ' + 'Today is ' + rows[0][0] + ' '+ rows[0][1] + '. You have ' + rows[1][1] + ' days left until you are late on plane maintence.');
			todays_date=rows[0][1];
			html=`
			<h1 style="margin-bottom:0px;"><u>`+rows[1][1]+`</u> Days Left</h1>
			<h2 style="display:inline;margin-bottom:0px;">`+rows[0][0]+`</h2>
			<h5 style="display:inline;line-height:0px;margin-top:-5px;">`+rows[0][1]+`</h5>
			`
			return grab_spreadsheet_data(time_spreadsheetId,time_data_range);
		})
		.then((rows) =>{
			// sort by date due ... heres how to sort in javascript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
			rows.sort((a,b)=>{return a[3]-b[3]});
			//only take the first three rows (what needs to be maintained in the near term).
			rows=rows.slice(0,3);
			html=html+`<p style="line-height:0px"><b>Near-term Mainteance To Occur</b></p>`;
			
			
			
			if(rows.length){
				rows.map((row)=>{
					html=html+`<p style="line-height:0px">${row[0]}:${row[3]} days</p>`;
				});
			}else{
				html=html+`<p>No Future Maintenance Items Found</p>`
			}
				
			const to = 'willbruey@gmail.com';
			const from = 'Bruey Airlines <airlines@brueyenterprises.com>';
			const subject ='N171ML Maintenance Report - '+ todays_date;		
			send_email(to,from,subject,html);
			
		})
		//if there was an error, print it to console.
		.catch(err=>console.log('Failed to update Will with Maintenance Report:  ' + err));	

	return 0;

});

//=======TEXT WILL TOTAL MAINTENACE SUMMARY===============
exports.text_maintenance_summary = functions.pubsub.schedule('every 365 days').onRun((context) => { 
	
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


//=======get and print user info to console===============
exports.list_users = functions.pubsub.schedule('every 1000 days').onRun((context) => { 

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


exports.grab_log_cell = functions.pubsub.schedule('every 1000 days').onRun((context) => { 
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


exports.test_text = functions.pubsub.schedule('every 1000 days').onRun((context) => { 
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





//=======LEARNING ABOUT PROMISES===============


exports.promise_test = functions.pubsub.schedule('every 1000 days').onRun((context) => { 

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