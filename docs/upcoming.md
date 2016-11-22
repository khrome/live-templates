##Upcoming Features

1. ****Components**** : use templates as webcomponents
2. ****Prescanners**** : You can also register a pre-scan function so that you can interact with the text templates before the binding and DOM conversion is done. if the function definition contains an argument, it will be passed an async callback which must be called to complete the scan

	    Templates.scanner(function(){
	        //return the results of the scan
	    });
	    
	    Templates.scanner(function(done){
	        //call done(results) to return the results of the scan and continue processing
	    });