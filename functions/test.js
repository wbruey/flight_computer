const csv = require('csv-parser')
const fs = require('fs')
const results = [];
 
 
 



function wait_bro(seconds){
	const wait_promise = new Promise((resolve,reject)=>{
		console.log('start');
		//resolve('fest');
		setTimeout(resolve('fest'),seconds*1000);		
	});
	return wait_promise;
}

wait_bro(90)
.then((trash)=>{
	console.log('done');
});


 
/* fs.createReadStream('test.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    console.log(results);
    // [
    //   { NAME: 'Daffy Duck', AGE: '24' },
    //   { NAME: 'Bugs Bunny', AGE: '22' }
    // ]
  });
  
  
x='35'

console.log(x)

x=Number(x)

console.log(x) */