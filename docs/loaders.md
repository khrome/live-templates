##Default Loader

    var request = require('request');
    var fs = require('fs');
    Live.defaultTemplateLoader = function(name, callback){
        //if not absolute, prepend the current dir
        var url = 
        	(name.indexOf('://') != -1 || name[0] == '/') ?
        	name :
        	__dirname + '/' + name;
        if(url[0] == '/' && module.exports){ //in node?
            fs.readFile(url, function(err, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }else{ //in the client
            request({
                uri : url
            }, function(err, req, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }
    };
If you need something more complex you'll have to write your own.
