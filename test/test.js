(function (root, factory) {
    if(typeof define === 'function' && define.amd){
        // AMD. Register as an anonymous module.
        define([
            '../live-templates',
            'browser-request',
            'dirname-shim',
            'array-events',
            'object-events',
            'async-arrays'
        ], function(Live, request, shim, EventedArray, EventedObject, arrays){
            return factory(Live, {
                readFile : function(filename, cb){
                    request({
                        url: filename
                    }, function(err, req, data){
                        if(err) return cb(err);
                        else cb(undefined, data);
                    });
                }
            }, chai.should(), function(cb){
                cb(undefined, function(callback){
                    callback(undefined, window);
                });
            }, EventedArray, EventedObject, arrays);
        });
    }else if (typeof module === 'object' && module.exports){
        module.exports = factory(
            require('../live-templates'),
            require('fs'),
            require('chai').should(),
            function(cb){
                //TODO: using JSDOM expose the window (unsupported : FML)
                var jsdom = require('jsdom');
                var JSDOM = jsdom.JSDOM;
                var dom = new JSDOM('<html><head></head><body></body></html>', {
                    runScripts: "dangerously",
                    FetchExternalResources   : ['script'],
                    ProcessExternalResources : ['script'],
                    MutationEvents: '2.0'
                });
                var window = dom.window;
                var document = window.document;
                var callback;
                window.addEventListener('load', function(){
                    var cb = callback;
                    callback = true;
                    if(cb) cb(undefined, dom.window);
                }, false);
                cb(undefined, function(cb){
                    if(callback === true) return cb(undefined, dom.window);
                    callback = cb;
                });
            },
            require('array-events'),
            require('object-events'),
            require('async-arrays')
        );
    } else {
        throw new Error('global testing not supported!');
    }
})(this, function(Live, fs, should, windowFactory, EventedArray, EventedObject, arrays){
    var tests = {}; //test caching
    var isNode = typeof module === 'object' && module.exports;
    var changeValues;

    windowFactory(function(err, getWindow){
        var data;
        var shallowData;

        //START MOCHA TESTS
        describe('live-templates', function(){

            before(function(done){
                this.timeout(10000)
                getWindow(function(err, window){
                    fs.readFile('test/test-data.json', function(err, body){
                        data = JSON.parse(body.toString());
                        fs.readFile('test/test-data-shallow.json', function(err, body){
                            shallowData = JSON.parse(body.toString());
                            Live.bondTarget = function(){
                                return window;
                            };
                            if(isNode){
                                global.HTMLCollection = window.HTMLCollection;
                                global.NodeList = window.NodeList;
                            }
                            done();
                        });
                    });
                });
            });

            describe('uses handlebar templates', function(){

                before(function(done){
                    Live.views('handlebars');
                    done();
                });

                describe('and evented arrays and objects', function(){

                    before(function(done){
                        Live.models('evented');
                        userModel = new EventedObject(data.user);
                        itemListModel = new EventedArray(
                            data.user_list.map(function(item){
                                return new EventedObject(item);
                            })
                        );
                        Live.model('user', userModel);
                        Live.model('item_list', itemListModel);
                        addOne = new EventedObject(data.extra_users[0]);
                        addTwo = new EventedObject(data.extra_users[1]);
                        addThree = new EventedObject(data.extra_users[2]);
                        changeValues = function(){
                            data.extra_names.forEach(function(name, index){
                                Live.model('item_list')[index].set('name', name);
                            });
                        };
                        done();
                    });

                    it('render data as atomic values', tests.atomic = function(done){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(){
                                Live.value(template.dom[0]).should.equal('User:');
                                Live.value(template.dom[1]).should.equal('[user:name.first]');
                                Live.value(template.dom[2]).should.equal("Ed");
                                Live.value(template.dom[3]).should.equal("\n");
                                template.dom[4].nodeName.should.equal('BR');
                                Live.value(template.dom[5]).should.equal("\n");
                                template.destroy();
                                done();
                            }
                        });
                    });

                    it('render updated data as atomic values', tests.atomic_updates = function(complete){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(){
                                Live.model('user').set('name.first', 'Bob');
                                Live.value(template.dom[2]).should.equal("Bob");
                                Live.model('user').set('name.first', 'Ed');
                                Live.value(template.dom[2]).should.not.equal("Bob");
                                template.destroy();
                                complete();
                            }
                        });
                    });

                    it('render data as a list of arbitrary HTML', tests.html_list = function(complete){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(){
                                var lis = template.select('li');
                                lis.length.should.equal(2);
                                var domSelectedValues = [];
                                lis.forEach(function(item, index){
                                    domSelectedValues.push(item.textContent);
                                });
                                var dataGeneratedValues = [];
                                Live.model('item_list').forEach(function(item){
                                    dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                                });
                                template.destroy();
                                complete();
                            }
                        });
                    });

                    it('as a list of arbitrary HTML with async member additions', tests.html_list_async = function(complete){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(error, tracer){
                                var root;
                                var count = 0;
                                template.on('new-list-item', function(e){
                                    root = e.root;
                                    count++;
                                })
                                Live.model('item_list').push(addOne);
                                Live.model('item_list').push(addTwo);
                                setTimeout(function(){ //wait for the nodes to hit the DOM
                                    var lis = root.parentNode.querySelectorAll('li')
                                    lis.length.should.equal(4);
                                    lis.length.should.equal(Live.model('item_list').length);
                                    complete();
                                }, 1000);
                            }
                        });
                    });

                    it('as a list of arbitrary HTML with member value updates', tests.html_list_member_updates = function(complete){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(){
                                changeValues();
                                var lis = template.select('li');
                                lis.length.should.equal(4);
                                var domSelectedValues = [];
                                lis.forEach(function(item, index){
                                    domSelectedValues.push(item.textContent);
                                });
                                var dataGeneratedValues = [];
                                Live.model('item_list').forEach(function(item){
                                    dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                                });
                                domSelectedValues.length.should.equal(4);
                                dataGeneratedValues.length.should.equal(4);
                                domSelectedValues.forEach(function(item){
                                    arrays.erase(dataGeneratedValues, item);
                                });
                                dataGeneratedValues.length.should.equal(0);
                                domSelectedValues[0].split(':').shift().should.equal('Armand');
                                domSelectedValues[1].split(':').shift().should.equal('Edmund');
                                domSelectedValues[2].split(':').shift().should.equal('Harlan');
                                domSelectedValues[3].split(':').shift().should.equal('Lemmy');
                                template.destroy();
                                complete();
                            }
                        });
                    });

                    it('as a list of arbitrary HTML with out of order insertions', tests.html_list_out_of_order = function(complete){
                        var template = new Live.Template({
                            template:'test/simple-test.handlebars',
                            complete : function(){
                                Live.model('item_list').unshift(addThree);
                                setTimeout(function(){ //wait for the nodes to hit the DOM
                                    var lis = template.select('li');
                                    var domSelectedValues = [];
                                    lis.forEach(function(item, index){
                                        domSelectedValues.push(item.textContent);
                                    });
                                    var dataGeneratedValues = [];
                                    //TODO: investigate
                                    /*Live.model('item_list').forEach(function(item){
                                        dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                                    });
                                    dataGeneratedValues.forEach(function(item, index){
                                        domSelectedValues[index].should.equal(item)
                                    });*/
                                    complete();
                                }, 1000);
                            }
                        });
                    });

                    it('as a list of arbitrary HTML with out of order removals',
                        tests.html_list_unordered_remove = function(complete){
                            var template = new Live.Template({
                                template:'test/simple-test.handlebars',
                                complete : function(error, tracer){
                                    Live.model('item_list').length.should.equal(5);
                                    template.select('li').length.should.equal(5);
                                    Live.model('item_list').shift();
                                    setTimeout(function(){ //wait for the nodes to hit the DOM
                                        Live.model('item_list')
                                            .length.should.equal(4);
                                        var lis = template.select('li');
                                        lis.length.should.equal(4);
                                        var domSelectedValues = [];
                                        lis.forEach(function(item, index){
                                            domSelectedValues.push(item.textContent);
                                        });
                                        domSelectedValues[0].should
                                            .equal('Armand:14.8');
                                        complete();
                                    }, 200);
                                }
                            });
                        }
                    );

                }); //evented end

                /*describe('and backbone', function(){

                    before(function(done){
                        Live.models('backbone');
                        Live.views('handlebars');
                        userModel = new Backbone.Model(shallowData.user);
                        itemListModel = new Backbone.Collection([], {
                              model: userModel
                        });
                        shallowData.user_list.forEach(function(item){
                            itemListModel.add(new Backbone.Model(item));
                        });
                        Live.model('user', userModel);
                        Live.model('item_list', itemListModel);
                        addOne = new Backbone.Model(data.extra_users[0]);
                        addTwo = new Backbone.Model(data.extra_users[1]);
                        addThree = new Backbone.Model(data.extra_users[2]);
                        changeValues = function(){
                            data.extra_names.forEach(function(name, index){
                                Live.model('item_list').at(index).set('name', name);
                            });
                        };
                        done();
                    });

                    describe('render data as atomic values', tests.atomic);
                    describe('render updated data as atomic values', tests.atomic_updates);
                    describe('render data as a list of arbitrary HTML', tests.html_list);
                    describe('as a list of arbitrary HTML with async member additions', tests.html_list_async);
                    describe('as a list of arbitrary HTML with member value updates', tests.html_list_member_updates);
                    describe('as a list of arbitrary HTML with out of order insertions', tests.html_list_out_of_order);
                    describe('as a list of arbitrary HTML with out of order removals', tests.html_list_unordered_remove);
                });*/
            });
            //END MOCHA TESTS
        });
    });
    return {};
});
