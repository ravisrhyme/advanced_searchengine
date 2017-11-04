/********************************************************************
 *
 * Filename      : app.js
 * Author        : Ravi Kiran Chadalawada
 *
 * Functionality : Runs a node.js server interacting with solr running 
                   on port 8983 and http-server running on port 8080.
                   It gets request from http-server(npm package) and 
                   queries solr, and replies back with data from  solr 
                   to http-server. 
                   Please refer to instrutions.pdf document in repo for 
                   more info on how to run this setup.
                   Report.pdf gives info on my results.
		   In-addition to the basic search capabilites that I built 
                   in my other repo(mini_searchengine), I added 
		   functionalities like spell-correct, and auto-suggestions
		   to this application.
*************************************************************************/


//import { train, correct } from 'speller';
var spell_checker = require('./norvig_spellchecker');
var express = require('express');
var app     = express();
var solr    = require('solr-client');
var fs      = require('fs')
var deepcopy = require("deepcopy");
var extractor = require('unfluff');


var client = solr.createClient();

var dict = Array(); // To declare a global dictionary to hold file mappings


app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    //res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.get('/', function (req, res) {
  //console.log(req);
	//console.log(req.query.id);
	entered_query = req.query.id 
	//var query = encodeURI(req.query.id);
	//console.log("Entered query is: "+ entered_query )
	corrected_query = spell_check(entered_query);
	/*Spell check will be one for all queries coming for first time from user*/
	if (req.query.spell_check == 1)
	{
		/*var array = ['ELNO','NATO','DoJ Woens','Dow Jones','Rio Olmypics','Rio Olympics','Poekmon Go','Pokemon Go','Cailfornia Wild Fires',                                'California Wild Fires','Doanld Trump','Donald Trump','Haryr Potter','Harry Potter','Brzail','Brazil',
			     'NOAT','NATO','Dow Njoes','Dow Jones','Rio Yolmpics','Rio Olympics','Pokoemn Go','Pokemon Go','Caloifrnia Wild Fires',                                'California Wild Fires','Dondal Trump','Donald Trump','Harpr Yotter','Harry Potter','Bralzi','Brazil']
        	index = array.indexOf(entered_query)
		
		//console.log("Index of " + entered_query + " is " + index)

		if (index == -1 || (index%2) != 0)
		{
			corrected_query = entered_query
		}
		else if ((index%2) == 0) {
			corrected_query = array[index+1]
		}*/

		//console.log("corrected query is " + corrected_query)
		if (entered_query == corrected_query)
		{
			correction_needed = 0;
			query = encodeURI(entered_query)
			var temp = deepcopy(entered_query)
		}
		else {
			correction_needed = 1;
			query = encodeURI(corrected_query);
			var temp = deepcopy(corrected_query)
		}
	}
	/* We landup here only when user insists to query with his original text after 
	 first time spell correction. No more corrections needed */
	else {
		correction_needed = 0;
		corrected_query = entered_query
		query = encodeURI(entered_query)
		var temp = deepcopy(entered_query)
	}
	var value = req.query.value;
	if (value == "default") {
	//console.log(req.query.value);
	var query = 'indent=on&q='+ query + '&wt=json';
	}
	else {
	//console.log(req.query.value);
	var query = 'indent=on&q='+ query + '&sort=pageRankFile%20desc&wt=json'
	}
	
	client.get('nyd/select',query,function(err,obj){
   		if(err){
        		console.log(err);
   		} else{
			var resp = deepcopy(obj);

			if (correction_needed == 1) {
				resp.response.docs[0].resourcename = 1
				resp.response.docs[0].title = corrected_query
				resp.response.docs[0].dc_title = entered_query
			}
			
			for(var index = 0; index < resp.response.docs.length; index++){
				snippet = ''
				var fullpath = resp.response.docs[index].id;
				console.log(index + ":" +fullpath);
				var filename = fullpath.replace(/^.*[\\\/]/, '');

				/******Logic for snippet*****************/
				//console.log(resp.response.docs[doc].id + ":" + dict[filename]);
				var data = fs.readFileSync(fullpath).toString();
				
				html_json = extractor(data);
				only_text = html_json.text
	
				
				var sentences = only_text.split(".");
				var split_words = temp.split(" ")
				
				no_of_sentences = 0
				for (var k = 0; k < split_words.length; k++)
				{
					var temp_snippet = ""
				for (var i = 0; i < sentences.length; i ++)
				{
					if (temp_snippet.length > 100)
					{
						break;
					}
					if ((sentences[i].toLowerCase().search(split_words[k].toLowerCase())) >= 0)
					{
						temp_snippet += sentences[i] + "..."
					}
				}
				snippet += temp_snippet;
				}
				//console.log("Snippet : " + snippet)
				if (!snippet)
				{
					snippet = html_json.title
				}
				resp.response.docs[index].id = dict[filename];
				resp.response.docs[index].description = snippet;
			}
			//print_url(obj.response.docs);
        		//console.log(obj.response.docs);
			 res.send(resp);
   		}
	});
  //res.send(JSON.stringify(response));
});


app.get('/suggest', function (req, res) {

	//console.log(req.query.term);
	prefix = ""
	if (req.query.term.indexOf(' ') >= 0)
	{
		temp = req.query.term.split(' ')
		//console.log(temp)
		no_of_words = temp.length
		//console.log(no_of_words)
		term_index = temp[no_of_words-1].toLowerCase()
		term = temp[no_of_words-1].toLowerCase()
		if (term)
		{
			// Jaffa Languge JS in a way!
			// I don't know how to check for empty string !!
			// Hence this empty if condition

			for (i = 0; i < (no_of_words-1); i++){
                        prefix += temp[i] + " "
                        console.log(prefix)
		 	}
		}
		else {
			//console.log("inside empty string check")
			term = temp[no_of_words-2].toLowerCase()
			term_index = temp[no_of_words-2].toLowerCase()
			for (i = 0; i < (no_of_words-2); i++){
                        prefix += temp[i] + " "
                        //console.log(prefix)
                        }
			//prefix = " "
		}
		//console.log(term_index)
		/*for (i = 0; i < (no_of_words-1); i++){
			prefix += temp[i] + " "
			console.log(prefix)
		}*/
		//console.log(prefix)
	}
	else {
		var term_index = deepcopy(req.query.term.toLowerCase()); // To use while retreiving Json
        	var term = encodeURI(req.query.term.toLowerCase());
	}
	var filter = ['document.getElementById','.html','dc:title','dc8xl0ndzn2cb.cloudfront.net','nexus.ensighten.com','right_rail_300x250_lower','right_rail_flex','delayload_done','b.scorecardresearch.com','base64.1q2w3_d54d4a6d3445f91b4d8700e54d90ddbc.min.js','by.rubiconproject.com']
	console.log(term);
	var suggestions = [];
        var query = 'indent=on&q='+ term + '&wt=json';
        client.get('nyd/suggest',query,function(err,obj){
                if(err){
                        console.log(err);
                }else{  
                        var resp = deepcopy(obj); 
			var json_term = resp.suggest.suggest[term_index];
			//console.log(json_term);
			if (term_index.length == 1){
				max_iter = 10;
			}
			else if (term_index.length == 2){
				 max_iter = 7;
			}
			else if (term_index.length >= 3){
                                 max_iter = 4;
                        }
			/* Fix for an issue found during testing.
			  If number of terms returned by solr is less than max_iter fixed.
			   app will crash without this condition. If no terms are suggested
			   by solr*/
			if(json_term.numFound < max_iter){
				max_iter = json_term.numFound
			} 	
                       for(var i = 0; i < max_iter ; i++){
				var sug = json_term.suggestions[i].term;
				var match = 0;
				for (j = 0; j < filter.length; j++ )
				{
					var str = filter[j]
					var n = sug.search(str)
					if (n > -1) {
						match = 1;
					}
				}
				if (match == 0)
				{
					suggestions.push(prefix + sug);
                                        //console.log("*****************",sug);
				}
                        }
                         res.send(suggestions);
                }
        });
});


function train_classifier()
{
    fs.readFile('big_nyd.txt', 'utf-8',function(err, data){
                if (err) {
                        throw err;
                }
                else{
            spell_checker.train(data);
            console.log("classifier trained!!")
                }
        });
}

function dummy_spell_check(temp) {
	var array = ['donld','donald']
	index = array.indexOf('donld')
	return 
}

function spell_check(temp) {

        var x = spell_checker.correct(temp);
        ///x = NorvigSpellChecker().correct(temp);
	console.log(x);
        if (x) {
		console.log("Did you mean " + x + "? or search instead for "+ temp);
        }
	else {
        console.log("Spelling looks correct"+ x +":"+ temp); 
	}
	return x;
}

function print_url(data)
{
	for(var doc in data){
		console.log(data[doc].id);
	}	
}
function make_dict() {
	fs.readFile('mapLATimesDataFile.csv', 'utf-8',function(err, data){
		if (err) {
        		throw err;
  		}
        	else{

			fill_dict(data);
                	//console.log("c99aec8e-3d68-4f79-91ad-621f05b824e5.html :" + dict['c99aec8e-3d68-4f79-91ad-621f05b824e5.html']);
        	}
	});
}

function fill_dict(data)
{
	var split_data = (data.split('\n'));
                for (var i = 0; i < split_data.length; i++)
                {
			//console.log(i, split_data[i]);
                        map = (split_data[i].split(','));
                        dict[map[0]] = map[1];
                }
}
app.listen(3000, function () {
	make_dict();
	train_classifier();
  console.log('Example app listening on port 3000!');
});

