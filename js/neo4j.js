var Neo4J = {
	doCommand: function(parms) {
		var callback=null;
		if (parms.callback) {
			callback=parms.callback;
			delete parms.callback;
		}
		$.ajax({
			cache: false,
			type:"POST",
			dataType: "json",
			data:parms,
			success:function(data) {
				console.log(data);
				if (!data) {
					Neo4J.showError("Error in processing "+parms.command);
					return null;
				} else if (data.result=='error') {
					Neo4J.showError(data.message);
					return null;
				} else {
					callback(data);
				}
			},
			error:function() {
				Neo4J.showError("Error in command execution");
			}
		});
	},
	listScripts:function(scripttype) {
		Neo4J.doCommand({command:'list', 'scripttype':scripttype, callback:function(data) {
			Neo4J.showList(data.files, scripttype);
		}});
	},
	execScript:function(script, scripttype, paraminput) {
		Neo4J.doCommand({command:'execute',script:script, scripttype:scripttype, paraminput:paraminput, callback:function(data) {
			/*try {
				data.response=$.parseJSON(data.response);
			} catch(e) {
			}*/
			Neo4J.showResponse(data);
		}});
	},
	saveScript:function(script,filename,description,scripttype,listorder, paraminput, overwrite) {
		Neo4J.doCommand({command:'save',filename:filename,description:description,script:script,scripttype:scripttype,listorder:listorder, paraminput:paraminput, overwrite:overwrite, callback:function(data) {
			Neo4J.showMessage(data.message);
			// reload script index
			Neo4J.listScripts(scripttype);
		}});
	},
	loadScript:function(scripttype,filename) {
		if (scripttype == '') {
			Neo4J.showError("No script type found");
			return;
		} else if(filename == '') {
			Neo4J.showError("No filename found");
			return;
		}
		Neo4J.doCommand({command:'load',filename:filename,scripttype:scripttype,ignoreCache:true,callback:function(data) {
			Neo4J.showMessage("Script "+filename+" loaded");
			Neo4J.showScript(data);
		}});
	},
	deleteScript:function(filename,scripttype) {
		Neo4J.doCommand({command:'delete',filename:filename,scripttype:scripttype,callback:function(data) {
			Neo4J.showMessage("Script "+filename+" deleted");
			Neo4J.clearScript();
			// reload script index
			Neo4J.listScripts(scripttype);
		}});
	},
	showList:function(files, scripttype) {
		if (!$.isArray(files)) {
			Neo4J.showError('Cannot load file list');
		} else {
			//empty the script index
			// $('#scriptindex').sortable("destroy");
			// $('#scriptindex').empty();
			$('#scriptindex_'+scripttype+' ol').html('');
			$.map(files, function(f,i) {
				// create new row in script index
				if (f.description=='') {f.description=f.filename;}
				$('<li><a href="?command=execute&filename='+f.scripttype+"/"+f.filename+'">'+f.description+'</a></li>')
					.attr('id','scr_'+f.scripttype+"/"+f.filename)
					.find('a').click(function() {Neo4J.loadScript(f.scripttype,f.filename);return false;}).end()
					.appendTo('#scriptindex_'+scripttype+' ol');
			});
				
			/*$('#scriptindex').sortable({
				start:function(event,ui) {
					$(ui.item).find('a').unbind('click');
				},
				update:function(event,ui) {
						var scriptorder = $('#scriptindex').sortable("toArray");
					// update sorted order on server
					scriptorder=$.map(scriptorder,function(s) {return s.replace(/^scr_/i,'');});
					Neo4J.doCommand({command:'sort',files:scriptorder.toString(),callback:function(data) {
						Neo4J.showMessage("Scripts re-sorted");
						var id = $(ui.item).attr('id').replace(/^scr_/i,'');
						var f = id.split('/');
						console.log(f);
						$(ui.item).find('a').click(function() {Neo4J.loadScript(f[0],f[1]);return false;});
					}});
				}
			});*/
		}
	},
	showError:function(message) {
		$('.alert-message').removeClass('success').addClass('error').fadeIn().find('p').text(message).end().delay(5000).fadeOut();
	},
	showMessage:function(message) {
		$('.alert-message').removeClass('error').addClass('success').fadeIn().find('p').text(message).end().delay(5000).fadeOut();
	},
	showScript:function(data) {
		$('#script').val(data.script);
		$('#description').val(data.description);
		$('#filename').val(data.filename);
		$('#listorder').val(data.listorder);
		$('#scripttype').val(data.scripttype);
		$('#paraminput').val(data.paraminput);
		$('#editor_tab a').click();
	},
	clearScript:function() {
		$('#script').val('');
		$('#description').val('');
		$('#filename').val('');
		$('#editor_tab a').click();
		$('#scripttype').val('');
		$('#paraminput').val('');
		$('#username').val('');
		$('#password').val('');
		$('#Rusername').val('');
		$('#Rpassword').val('');
		$('#email').val('');
	},
	showResponse:function(response) {
		var data = {};
		try {
			data=JSON.parse(response);
		}catch(e){
			data=response;
		}
		$('#response').html('<pre class="code javascript">'+JSON.stringify(data,null,"\t")+'</pre>');
		$('.code').each(function(i, e) {hljs.highlightBlock(e,'    ');});
		$('#results_tab a').click();
	},
	listAllScripts : function(){
		Neo4J.listScripts('lily');
		Neo4J.listScripts('nodejs');
		Neo4J.listScripts('neo4j');
		Neo4J.listScripts('solr');
	}
};

$(document).ready(function() {
	// Tabs handler
	$('#neo4j .tabs li a').click(function() {
		var tab=$(this).parents('li');
		var id=$(tab).attr('id');
		$(tab).parents('ul').find('li').removeClass('active');
		$(tab).addClass('active');
		$('.tabcontent').hide();
		$('#'+id+'_content').show();
	});
	// alert message close button
	$('.alert-message').click(function() {$('#message').find('p').text('').end().fadeOut();});
	// execute script
	$('#execbtn').click(function() {Neo4J.execScript($('#script').val(), $('#scripttype').val(), $('#paraminput').val());});
	$('#loginbtn').click(function() {
		Neo4J.doCommand({command:'login', 'username':$('#username').val(), 'password':$('#password').val(), callback:function(data) {
			console.log('show oodebe');
			if (data.result=='success') {
				// $('.tabcontent').show();
				// $('.tabs').show();
				// $('#loginform').hide();
				// $('#help').show();
				window.location.href="/";
				Neo4J.listAllScripts();
			}
		}});
	}); 
	// save script
	$('#savebtn').click(function() {
		Neo4J.saveScript($('#script').val(), $('#filename').val(), $('#description').val(), $('#scripttype').val(),$('#listorder').val(), $('#paraminput').val(), $('#overwrite').attr('checked'));
	});
	// load script
	$('#loadbtn').click(function() {
		Neo4J.loadScript($('#scripttype').val(),$('#filename').val());
	});
	// delete script
	$('#deletebtn').click(function() {
		if(confirm('Are you Sure to Delete')) {
			Neo4J.deleteScript($('#filename').val(),$('#scripttype').val());
		}
	});
	// clear script
	$('#clearbtn').click(function() {
		Neo4J.clearScript();
	});
	// reload script
	$('#reloadScripts').click(function() {
		Neo4J.listAllScripts();
	});
	
	$('#testsequence li').css('cursor','pointer');
	$('#testsequence li ol').hide();
	$('#testsequence li').toggle(function(){$(this).find('ol').show()},function(){$(this).find('ol').hide()});
	
	$('#scriptindex li').css('cursor','pointer');
	$('#scriptindex li ol').hide();
	$('#scriptindex li').toggle(function(){$(this).find('ol').show()},function(){$(this).find('ol').hide()});
	// load script index
	// Neo4J.listAllScripts();
	// $('.tabcontent').hide();
	// $('.tabs').hide()
	// $('#help').hide()
	//index.html when inside oodebe
 	if ($('.tabs').length>0) {
		$.ajax({url:"html/header.html", cache:false, dataType:'html',success:function(data) {
			$('body').append(data);
			$('.nav li:first').addClass('active');
			$('#aboutlink').click(function() {
				$('#aboutbox').show();
			});
			$('#aboutclose').click(function() {
				$('#aboutbox').hide();
			});
			$('#logout').click(function() {
				Neo4J.doCommand({command:'logout', callback:function(data) {
					console.log('hide oodebe');
					if (data.result=='success') {
						window.location.href="/";
					}
				}});
			}); 
		}}).error(function() { alert("error"); });
		Neo4J.listAllScripts();
	} else {
		//when login form
	
		$('.nav li:first').addClass('active');
		$('#aboutlink').click(function() {
			$('#aboutbox').show();
		});
		$('#aboutclose').click(function() {
			$('#aboutbox').hide();
		});
		$('#registerbtn').click(function() {
			$('#loginform').hide();
			$('#registerform').show();
		}); 
		$('#backbtn').click(function() {
			$('#registerform').hide();
			$('#loginform').show();
		});
		$('#createbtn').click(function() {
			Neo4J.doCommand({command:'newuser','username':$('#Rusername').val(), 
			'password':$('#Rpassword').val(), 'email':$('#email').val(), callback:function(data) {
				Neo4J.showMessage(data.message);
				Neo4J.clearScript(); 
			}});
	});		
		$('#registerform').hide();
	}
	$("#registerform form").validate();		
	$("#loginform form").validate();		
});
