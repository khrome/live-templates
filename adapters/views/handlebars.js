(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['handlebars'], factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('handlebars'));
    }else{
        root.LiveTemplatesHandlerBarsAdapter = factory(root.Handlebars);
    }
}(this, function(Handlebars){
    var handlebarsTemplates = function(loader){ //handlebars implementation
        var cache = {};
        if(Handlebars.default) Handlebars = Handlebars.default; //yay, node & the browser come in differently :P
        var result = {
            macro : function(options, callback){
                options = options || {};
                if(typeof options == 'string') options = { name : options };
                Handlebars.registerHelper(options.name, function(){
                    var args = Array.prototype.slice.call(arguments);
                    var opts = (typeof args[args.length-1] == 'object'?args.pop():{});
                    opts.args = args;
                    return callback.apply(this, [opts, opts.fn]);
                });
            },
            render : function render(template, data, callback){
                if(cache[template]){
                    callback(undefined, cache[template](data));
                }else{
                    loader(template, function(err, body){
                        if(err) return callback(err);
                        cache[template] = Handlebars.compile(body);
                        render(template, data, callback);
                    })
                }
            },
            literal : function(str){
                return new Handlebars.SafeString(str);
            },
            /*block : function(context, data, options){
                return options.fn(context, { data: data });
            },*/
            context : function(data){
                return Handlebars.createFrame(data);
            }
        };
        return result;
    };
    return handlebarsTemplates;
}));