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



//returns a promise to grab spreadsheet data from google API given a spreadsheet ID and a ranges to grab data from
function grab_batch_spreadsheet_data(spreadsheetId,ranges){
	//construct the promise to return
	const googles_promise = new Promise((resolve,reject)=>{
		const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});  //create a google sheets object interface object with my api key
		sheets.spreadsheets.values.batchGet({  //use that api object to get spreadsheet data in a spreadsheet at a ranges
			spreadsheetId: spreadsheetId,
			ranges: ranges,
		}, (err, res) => {
			if (err){
				console.log('Google API didnt work');
				throw new Error(err);
			} else {
				const valueRanges = res.data.valueRanges;
				if (valueRanges.length) {
				  resolve(valueRanges);
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
exports.email_maintenance_summary = functions.pubsub.schedule('every 2 minutes').onRun((context) => { 
	
	//first get the maintenance report
	const spreadsheet='1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0';
	const data_ranges=['routine_time!B1:C2','routine_time!A7:D','routine_use!B1:B2','routine_use!A7:D'];
	
	var html='<p>ERROR</p>';
	var todays_date='error';
	var todays_tach='error';
	var days_to_go='error';
	var hours_to_go='error';
	var day_of_the_week='error';
	
	//get a promise to do the things (grab data and then email) then do them.
	const promise_grab_maintenance = grab_batch_spreadsheet_data(spreadsheet,data_ranges)
		//then format the data from the spreadsheeet to create the message you want to send.  remember, youre passing a function to the .then method slot.
		.then((valueRanges) =>{
			
			//first grab the rows from the first (zeroth) data set which has dates
			dates=valueRanges[0].values;
			console.log('Mainteance data gathered: ' + 'Today is ' + dates[0][0] + ' '+ dates[0][1] + '. You have ' + dates[1][1] + ' days left until you are late on plane maintence.');
			todays_date=dates[0][1];
			days_to_go=dates[1][1];
			day_of_the_week=dates[0][0];

			
			//Next grab the rows from the 2nd data set which has time based maintenace items
			days=valueRanges[1].values;
			// sort by date due ... heres how to sort in javascript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
			days.sort((a,b)=>{return a[3]-b[3]});
			days=days.slice(0,3);


			tachs=valueRanges[2].values;
			//Next grab the rows from the 3rd data set which is plane hour information.
			todays_tach=tachs[0][0];
			hours_to_go=tachs[1][0];
			console.log('Mainteance data gathered: ' + 'Tach is at: ' +todays_tach+ '. You have ' + hours_to_go + ' hours left until you are late on plane maintence.');
			
			// finally grab the rows from the 4th data set which is tach hours for maintenance items.
			hours=valueRanges[3].values;
			hours.sort((a,b)=>{return a[3]-b[3]});
			hours=hours.slice(0,3);
			
			//print stuff to HTML starting with todays status and headers
			html=`
			<h1 style="margin-bottom:0px;"><u>`+days_to_go+`</u> Days Left  &  <u>`+hours_to_go+`</u> Tach Hours Left</h1>
			<h2 style="display:inline;margin-bottom:0px;">`+day_of_the_week+`</h2>
			<h5 style="display:inline;line-height:0px;margin-top:-5px;">`+todays_date+`</h5>
			<table>
				<tr>
					<td><b>System</b></td>	 <td></td><td></td><td></td><td></td><td></td><td></td>   <td style="text-align:left"><b>Due</b></td>
				</tr>
			`;			
			
			//next is to iterate over near term maintenance and put that into the html
			//first add suffix days or hours
			days.map((day)=>{day.push('days');day.push(day[3]);});
			hours.map((hour)=>{hour.push('tach hours');hour.push(String(hour[3]*7));});  //multiply by 7 for hours so that when we sort we equivalent 1 tach hour to 7 days assuming i fly 1 hour per week this is just to look nice on the sort
			//next concatinate them
			nearterm_maintenances=days.concat(hours);
			nearterm_maintenances.sort((a,b)=>{return a[5]-b[5]});
			nearterm_maintenances.map((nearterm_maintenance)=>{
				html=html+`<tr><td>${nearterm_maintenance[0]}</td>    <td></td><td></td><td></td><td></td><td></td><td></td>      <td>${nearterm_maintenance[3]} ${nearterm_maintenance[4]}</p>`;
			});			
			html=html+'</table>'
			
			
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
exports.text_maintenance_summary = functions.pubsub.schedule('every 23 hours').onRun((context) => { 
	
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





//=======LEARNING ABOUT PROMISES===============


exports.promise_test = functions.pubsub.schedule('every 23 hours').onRun((context) => { 

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