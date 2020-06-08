//====================INCLUDE DEPENDENCIES============================
const functions = require('firebase-functions');
const admin = require('firebase-admin');
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
const N1717ML_maintenance_spreadsheet_id='1drcYhNrzV9IPNpCUqKCbhdVfr3wlQ-eW8p_zujWRMu0';
const N1717ML_maintenance_data_ranges=['routine_time!B1:C2','routine_time!A7:D','routine_use!B1:B2','routine_use!A7:D','one_off!A2:D'];
const db_location_of_maintenace_subscribers='/maintenance_subscribers';
const db_location_of_reports='/reports';


//===================Global Variables====================================
admin.initializeApp();
var db = admin.database();

//{===================HELPER FUNCTIONS=====================================


//===========Function: Batch Grab Data of a list of ranges in a google sheet. ======================
//INPUT: grab_batch_spreadsheet_data(spreadsheetId,ranges) ....... example:('lajdsfj54lkj56' , ['A1:B3', 'D3':F5, ... etc ] )
//OUTPUT: A Promise that resolves as a list of data objects with a single object strucutre shown below  https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values#ValueRange
// a list of these objects for each range of data inputted:
//{ 
//  "range": string,
//  "majorDimension": enum (Dimension),
//  "values": [
//    array
//  ]
//}
function grab_batch_spreadsheet_data(spreadsheetId,ranges){
	//construct the promise to return 
	const googles_promise = new Promise((resolve,reject)=>{
		const sheets = google.sheets({version: 'v4', auth: functions.config().google_auth.api_key});  //create a google sheets object interface object with my api key
		sheets.spreadsheets.values.batchGet({  //use that api object to get spreadsheet data in a spreadsheet at a ranges
			spreadsheetId: spreadsheetId,
			ranges: ranges,
		}, (err, res) => {
			if (err){
				console.log('Did not successfully use google API:   ' + err);
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

//===========Function: Format N1717ML maintenance data===========
//INPUT:  a 1D array of objects of type "ValueRange" which are the data object for each data range pulled from google shets api. ValueRanges[2].value would be a 2-d array of strings of whatever is in the cells of the spreadsheet ranges ....  example [ValueRange1,ValueRange2...  https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchGet
//OUTPUT: an object with properly formatted summary of the data.  maintenance_summary_object={report_html:'html string', todays_date:'date' .... etc see definition below on next line
function format_N1717ML_data(valueRanges){
	maintenance_summary_object={
		report_html:'<p>ERROR</p>',
		todays_date:'error',
		todays_tach:'error',
		days_to_go:'error',
		hours_to_go:'error',
		day_of_the_week:'error',
		notable_risks:[]
	}

    //{first grab the rows from the first (zeroth) data set which has dates
	dates=valueRanges[0].values;
	console.log('Mainteance data gathered: ' + 'Today is ' + dates[0][0] + ' '+ dates[0][1] + '. You have ' + dates[1][1] + ' days left until you are late on plane maintence.');
	maintenance_summary_object.todays_date=dates[0][1];
	maintenance_summary_object.days_to_go=dates[1][1];
	maintenance_summary_object.day_of_the_week=dates[0][0];
	//}
	
	//{Next grab the rows from the 2nd data set which has time based maintenace items
	days=valueRanges[1].values;
	// sort by date due ... heres how to sort in javascript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
	days.sort((a,b)=>{return a[3]-b[3]});
	days=days.slice(0,3);  //only keep the top 3
	//}

	//{Next grab the rows from the 3rd data set which is plane hour information.
	tachs=valueRanges[2].values;
	maintenance_summary_object.todays_tach=tachs[0][0];
	maintenance_summary_object.hours_to_go=tachs[1][0];
	console.log('Mainteance data gathered: ' + 'Tach is at: ' +maintenance_summary_object.todays_tach+ '. You have ' +maintenance_summary_object.hours_to_go + ' hours left until you are late on plane maintence.');
	//}
	
	//{ finally grab the rows from the 4th data set which is tach hours for maintenance items.
	hours=valueRanges[3].values;
	hours.sort((a,b)=>{return a[3]-b[3]});
	hours=hours.slice(0,3);  //only keep the top 3
	//}
	
	//{oops one more don't forget 5th data set to get the high risks
	risks=valueRanges[4].values;
	maintenance_summary_object.notable_risks=[];
	risks.map((risk)=>{
		//console.log(risk);
		if(risk[1].toUpperCase()==='LOW' || risk[1].toUpperCase()==='PERFORMANCE'|| risk[2].toUpperCase()==='FIXED'|| risk[3].toUpperCase()==='FIXED'){
			trash=3; // do nothing
		}else{
			maintenance_summary_object.notable_risks.push(risk);
		}
	});	
	//}
	
	//{take this data and make an HTML display from it.
	maintenance_summary_object.report_html=`
	<h1 style="margin-bottom:0px;"><u>`+maintenance_summary_object.days_to_go+`</u> Days Left  &  <u>`+maintenance_summary_object.hours_to_go+`</u> Tach Hours Left</h1>
	<h2 style="display:inline;margin-bottom:0px;">`+maintenance_summary_object.day_of_the_week+`</h2>
	<h5 style="display:inline;line-height:0px;margin-top:-5px;">`+maintenance_summary_object.todays_date+`</h5>`
	
	//then print the high risks
	maintenance_summary_object.report_html=maintenance_summary_object.report_html+`
		<table style="border:1px solid black">
		<tr><td><b>Medium to High Perceived System Risks</b></td>	 <td></td><td></td><td></td><td></td><td></td><td></td>   <td style="text-align:left"><b>Magnitude</b></td> </tr>
	`
	//iterate over the notable risks
	maintenance_summary_object.notable_risks.map((notable_risk)=>{
		maintenance_summary_object.report_html=maintenance_summary_object.report_html+`<tr><td>${notable_risk[0]}</td>    <td></td><td></td><td></td><td></td><td></td><td></td>      <td>${notable_risk[1]}</p>`;
	});				
	maintenance_summary_object.report_html=maintenance_summary_object.report_html+'</table>';

	// then print the rountine maintenance.	
	maintenance_summary_object.report_html=maintenance_summary_object.report_html+`<p></p><table style="border:1px solid black">
		<tr>
			<td><b>Upcomin System Maintenance</b></td>	 <td></td><td></td><td></td><td></td><td></td><td></td>   <td style="text-align:left"><b>Due</b></td>
		</tr>
	`;			
	//iterate over near term maintenance and put that into the maintenance_summary_object.report_html
	//first add suffix days or hours
	days.map((day)=>{day.push('days');day.push(day[3]);});
	hours.map((hour)=>{hour.push('tach hours');hour.push(String(hour[3]*7));});  //multiply by 7 for hours so that when we sort we equivalent 1 tach hour to 7 days assuming i fly 1 hour per week this is just to look nice on the sort
	//next concatinate them
	nearterm_maintenances=days.concat(hours);
	nearterm_maintenances.sort((a,b)=>{return a[5]-b[5]});
	nearterm_maintenances.map((nearterm_maintenance)=>{
		maintenance_summary_object.report_html=maintenance_summary_object.report_html+`<tr><td>${nearterm_maintenance[0]}</td>    <td></td><td></td><td></td><td></td><td></td><td></td>      <td>${nearterm_maintenance[3]} ${nearterm_maintenance[4]}</p>`;
	});			
	maintenance_summary_object.report_html=maintenance_summary_object.report_html+'</table>'	
	//}
	
	return maintenance_summary_object;
}

//==========Function: Get a snapshot tranche of the firebase realtime database.  =========================
//INPUT: a string of the path of the database tranche you want. example: '/maintenance_subscribers'
//OUTPUT: a promise that gets resolved to the JSON TREE OBJECT that is at that path.  The database listener is then turned off after getting the snapshop so if data is updated in the database AFTER this function is called, nothing gets triggered again.
function get_database_tranche(database_path){
	const firebases_promise = new Promise((resolve,reject)=>{ //create the promise 
		var ref = db.ref(database_path);  //create the database reference object
		ref.once("value", snapshot =>{ //"value" indicates that what part of the  trance gets read, and what the trigger is (although trigger doesnt really matter here since this is the .once method.  more info here: https://firebase.google.com/docs/database/admin/retrieve-data#section-detaching-callbacks
			data_object_value=snapshot.val(); //resolves the data object to fulfill the promise  a snapshot is an object with data from the database at snapshop.val  https://firebase.google.com/docs/reference/android/com/google/firebase/database/DataSnapshot
			resolve(data_object_value);
		}, errorObject=>{ 
			console.log("The read failed: " + errorObject.code);
			throw new Error(errorObject);
		});
	});
	return firebases_promise;
}

//==========Function: write (*Update*) data to firebase   =========================
//INPUT: a string of the path of the database tranche you want as your root for example: , and a key-value json object with updates for example {"will/email":"willbruey@gmail.com","paul/email":"pbruey@wellspan.com"}
//OUTPUT:  a PROMISE to write to the database resolved to success message when complete.
function update_database(database_path,updates_object){
	const firebases_promise = new Promise((resolve,reject)=>{ //create the promise 
		var ref = db.ref(database_path);  //create the database reference object
		ref.update(updates_object,err=>{
			if(err){
				console.log('ERROR, unable to update firebase database: '+err);
			}else{
				console.log('Successfully updated firebase database');
				resolve('success');
			}
		});
	});
	return firebases_promise;
}



//==========Function: Get a list of user_ids from a database tranche of type "subscription" ... i made up this type ... basically its a database tranche that is structure like per the link at the end of this line, it is good to structure members of a chat or subscription list like this in the database {subscription_name : {user_name1:'1',user_name2:'0',user_name3:'1'...}}  https://firebase.google.com/docs/database/web/structure-data
//INPUT: a database tranche of type "subscribers" represented as a key-value-json-object  : {user_name1:'1',user_name2:'0',user_name3:'1'...}    
//OUTPUT: a list of user ids ['uid1','uid2',....
function get_user_ids_from_db_subscribers_object(db_subscribers_object){
	uids=[];
	console.log('parsing user ids from db tranche of type subscription_list ');
	for(var subscriber in db_subscribers_object){
		if (db_subscribers_object[subscriber]=='1'){
				uids.push(subscriber);
		}
	}
	if(uids.length){
		console.log('here are the uids found:');
		console.log(uids);

	}else{
		console.log('CAUTION no subscriber uids found while trying to execute function get_database_tranche(database_path)');
	}
	return uids;	
}


//==========Function: get key-value object of emails from a list of user ids.===================
//INPUT: a list of user ids ['uid1','uid2',....         
//OUTPUT: a PROMISE to deliver a key-value object of emails for those ids address_book={ {uid1:'email1',uid2:'email2' .....} 
function get_emails_of_users(list_of_uids){
	const firebases_promise = new Promise((resolve,reject)=>{
		uid_identifier_search_criteria=[];// this will be builts as follows:     key-value objects [{ uid: 'uid1' },{ uid: 'uid2' }.... etc] from which to use as filter criteria for selecting firebase users using admin.auth().getUsers per https://firebase.google.com/docs/auth/admin/manage-users  basically this is a list of identifiers that a .getUsers method could use to find users that meet any of these criteria in the list for this particular use-case its all user_ids that we want
		list_of_uids.forEach(subscriber=>{  //for each user id, add it to the criteria object list that will be used to search the firebase database.
			uid_identifier_search_criteria.push({uid: subscriber});					
		});
		console.log('here is the criteria for which we will look up users to get their email:');
		console.log(uid_identifier_search_criteria);
		address_book={}; //create the address book object ={ {uid1:'email1',uid2:'email2' .....} 
		admin.auth().getUsers(uid_identifier_search_criteria)  //tell the database to get the users based on the uid identifiers provided  as [{ uid: 'uid1' },{ uid: 'uid2' }.... etc]
		.then(users_object=>{ //wait 
			users_object.users.forEach((userRecord)=>{  //for each user that is returned
				address_book[userRecord.uid]=userRecord.email; //append the address book with the key=uid and value=email pair. 
			})
			console.log('generated this address book from the uids:');
			console.log(address_book);
			resolve(address_book);
		})
		.catch(err=>console.log('Failed to get user emails using uids from the firebase database: '+err));		
		
	});
	return firebases_promise;
}


//===========Function: Send a Text Message =====================================
//INPUT: send_text_message(phone,text_message)........ example:('7174756561','hello there')
//OUTPUT: a response from twillo that resolves as either a sent receipt from twillo or an error.
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

//===========Function: Send Email From Bruey Airlines (Low throughput)==========================
// INPUT: send_email(to,subject,html) to address, subject, html   .... example ('willbruey@gmail.com','this is a subject line',<h1> Hello! </h1>)
// OUTPUT:  sends email from airlines@brueyenterprises.com  uses that email as credentials
// not to be used for mass or fast emails.  small number of users or otherwise i need to get my own SMTP client.
function send_email(to,subject,html){
	const mailOptions = {
		to:to,
		from:'Bruey Airlines <airlines@brueyenterprises.com>',
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
			console.log('Sent an email:  ' + JSON.stringify(info));
		}
	});
	return 0;
}


//===========Function: Send Bulk Emails From Bruey Airlines (Low throughput)==========================
// INPUT: send_bulk_emails(destination_addresses,subject,html) a list of strings containing destination email address, the subject line, and the html to be sent .... example (['wbruey@gmail.com', 'pbruey@gmail.com'...],'this is a subject line',<h1> Hello! </h1>)
// OUTPUT: sends emails from airlines@brueyenterprises.com  uses that email as credentials
function send_bulk_emails(destination_addresses,subject,html){
	console.log('Attempting to send bulk emails to a list of address:');
	console.log(destination_addresses);
	destination_addresses.map((destination_address)=>{send_email(destination_address,subject,html)});	
}


//}  =====================end of helper functions=========================================

//{====================FIREBASE CLOUD FUNCTIONS===============

//=======Firebase Cloud Function: Email Maintenance Summary Report to Subscribers Every Thurs at 9am eastern===============

exports.email_maintenance_summary = functions.pubsub.schedule('every thursday 09:00').onRun((context) => { 
//exports.email_maintenance_summary = functions.pubsub.schedule('every 2 minutes').onRun((context) => { 
//this function emails out the maintenance report each thurs morning at 9am.
	
	//first get a promise for the appropriate maintenance data from the 171ml maintenance spreadsheet via the google sheet api
	const promise_grab_maintenance = grab_batch_spreadsheet_data(N1717ML_maintenance_spreadsheet_id,N1717ML_maintenance_data_ranges)
		//then format the data from the spreadsheeet to create the message you want to send.  remember, youre passing a function to the .then method slot.
		.then((valueRanges) =>{
			maintenance_summary=format_N1717ML_data(valueRanges);  //get the maintenance summary
			return get_database_tranche(db_location_of_maintenace_subscribers); //get the promise of a JSON tree object with values that are a subscription list in the database that have subscribed to get the maintenance summary
		})
		.then((tranche_snapshot_values)=>{  //   extract/format a list of users from the database tranche associated with subscribers as a json tree object
			uids=get_user_ids_from_db_subscribers_object(tranche_snapshot_values); 
			return get_emails_of_users(uids);   //return a promise for an address book (key / value object with uid:email_address) 
		})
		.then((address_book)=>{
			list_of_email_strings=[];  //empty list that we'll put emails into
			for(const user_id in address_book){ //for each user in the address book, add the users email to the list of emails to send. 
				list_of_email_strings.push(address_book[user_id]);
			}
			send_bulk_emails(list_of_email_strings,'N171ML Maintenance Report - '+ maintenance_summary.todays_date,maintenance_summary.report_html);
		})
		.catch((err)=>{
			console.log('Error, unable to gather, format, and send maintenace report:  '+err)
			to = 'willbruey@gmail.com';
			subject ='ERROR - N171ML Maintenance Report';		
			send_email(to,subject,'<p>Error, unable to gather, format, and email out maintenace report!  Check Firebase Logs</p>');
		});
		
	return 0;

});


//=======Firebase Cloud Function: Write Maintenance Summary Report HTML to Database Every Day===============
exports.store_maintenance_summary = functions.pubsub.schedule('every day 05:00').onRun((context) => { 	
//exports.save_maintenance_summary_html_to_db = functions.pubsub.schedule('every 2 minutes').onRun((context) => { 
//this function gathers the maintenance data, formats to html and writes it to the database so that a website can pull from it.
	
	//first get a promise for the appropriate maintenance data from the 171ml maintenance spreadsheet via the google sheet api
	const promise_grab_maintenance = grab_batch_spreadsheet_data(N1717ML_maintenance_spreadsheet_id,N1717ML_maintenance_data_ranges)
		//then format the data from the spreadsheeet to create the message you want to send.  remember, youre passing a function to the .then method slot.
		.then((valueRanges) =>{
			maintenance_summary=format_N1717ML_data(valueRanges);
			return(update_database(db_location_of_reports,{"maintenance_summary_html":maintenance_summary.report_html}));}
		).then((response_string)=>{
			console.log(response_string);
		})
		.catch((err)=>{
			console.log('Error, unable to update firebase database with html of maintenace report:  '+err)
			to = 'willbruey@gmail.com';
			from = 'Bruey Airlines <airlines@brueyenterprises.com>';
			subject ='ERROR - N171ML Maintenance Report';	
			send_email(to,subject,'<p>Error, unable to gather, format, and update firebase with the html of the maintenace report!  Check Firebase Logs</p>');			
		});			
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

//}=====================end of FIREBASE CLOUD functions=========================================