// thanks  https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
String.prototype.replaceAll = function (search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

// Thanks
// https://stackoverflow.com/questions/3066586/get-string-in-yyyymmdd-format-from-js-date-object
Date.prototype.yyyymmdd = function () {
	var mm = this.getMonth() + 1; // getMonth() is zero-based
	var dd = this.getDate();

	return [this.getFullYear(),
		(mm > 9 ? '' : '0') + mm,
		(dd > 9 ? '' : '0') + dd
	].join('-');
};

Date.prototype.toInt = function () {
	var mm = this.getMonth() + 1; // getMonth() is zero-based
	var dd = this.getDate();
	var hh = this.getHours();
	var MM = this.getMinutes();
	var ss = this.getSeconds();

	return parseInt([this.getFullYear(),
		(mm > 9 ? '' : '0') + mm,
		(dd > 9 ? '' : '0') + dd,
		(hh > 9 ? '' : '0') + hh,
		(MM > 9 ? '' : '0') + MM,
		(ss > 9 ? '' : '0') + ss
	].join(''));
};

var app = function () {

	var settings = {
		mode: "initial"
	};

	var filesToDelete = [];
	var orginalFiles = {};

	var globalKey = APIkey;

	$.ajaxSetup({
		cache: false,
		data: {
			access_token: globalKey
		}
	});

	var urlWithKey = function (url, key) {
		return function () {
			return url + "?access_token=" + key;
		};
	};

	var nativeSync = Backbone.sync;
	Backbone.sync = function (method, model, options) {
		if (model && (method === 'create')) {
			model.url = urlWithKey('https://api.github.com/gists', globalKey);
		}
		if (model && (method === 'update')) {
			if (model.get('id') !== null) {
				method = 'patch';
				// console.info("id this is a patch");
				model.url = urlWithKey('https://api.github.com/gists/' + model.get('id'), globalKey);
			} else {
				// console.info("no id");
				model.url = urlWithKey('https://api.github.com/gists', globalKey);
			}
		}
		nativeSync(method, model, options);
	};

	var model = Backbone.Model.extend({
		defaults: {
			id: null,
			description: null,
			html_url: "https://gist.github.com/",
			updated_at: 9999999999999999,
			language: "",
			public: false,
			tags: " "
		},
		destroy: function (attrs, options) {
			var alteredUrl = this.get("url") + '?access_token=' + globalKey;
			var opts = _.extend({
				url: alteredUrl
			});

			return Backbone.Model.prototype.destroy.call(this, opts);
		},

		// Overwrite save function
		save: function (attrs, options) {
			modelTaggin(this);
			options || (options = {});
			attrs || (attrs = _.clone(this.attributes));
			var newFiles = {};

			// deleted files first, so they can be appended if needed
			filesToDelete.forEach(function (tbd) {
				// If the file existed then it can be deleted
				if (typeof (orginalFiles[tbd]) !== 'undefined') {
					newFiles[tbd] = {};
				}
			});

			_.forEach(fileCollection.models, function (model) {
				if (typeof (model) !== 'undefined') {
					if (model.get('deleteFlag') === true) {
						newFiles[model.get('filename')] = {};
						model.destroy();
					} else {
						// console.log('model to keep')
						// console.log(model)
						newFiles[model.get('filename')] = {
							'content': model.get('content')
						};
					}
				}
			});

			// 	console.log('newFiles');
			// 	console.log(newFiles);

			attrs.files = newFiles;

			// delete attrs.public
			delete attrs.comments;
			delete attrs.comments_url;
			delete attrs.commits_url;
			delete attrs.created_at;
			delete attrs.forks_url;
			delete attrs.git_pull_url;
			delete attrs.git_push_url;
			delete attrs.html_url;
			delete attrs.id;
			delete attrs.owner;
			delete attrs.truncated;
			delete attrs.updated_at;
			delete attrs.url;
			delete attrs.language;
			delete attrs.tags;
			delete attrs.user;
			delete attrs.cleanUpdateDate;
			delete attrs.intUpdateDate;
			options.data = JSON.stringify(attrs);

			// 	console.log(options);

			// Proxy the call to the original save function
			return Backbone.Model.prototype.save.call(this, attrs, options);
		}

	});

	var GistCollection = Backbone.Collection.extend({
		model: model,
		url: 'https://api.github.com/gists',
		comparator: function (model) {
			return -model.get('intUpdateDate');
		}

	});

	var file = Backbone.Model.extend({
		defaults: {
			content: "",
			deleteFlag: false,
			nameChange: 'false'
		},
		initialize: function () {
			this.collection.on("change:filename", function () {

				if (this.previous('filename') !== this.get('filename')) {
					this.set('nameChange', this.previous('filename'));
					// 	console.log("the name changed")
					filesToDelete.push(this.previous('filename'));
					// 	console.log(this.get('nameChange'))
				}
			}, this);

			// 	this.collection.on("change:deleteFlag", function () {
			// 		if (this.get('deleteFlag') === true) {
			// 			filesToDelete.push(this.get('filename'));
			// 		// 	filesToDelete.push(this.previous('filename'));
			// 			console.log(this.get('nameChange'))
			// 		}
			// 	}, this);

		}
	});

	var FileCollection = Backbone.Collection.extend({
		model: file
	});

	var fileCollection = new FileCollection();
	var fileTypeCollection = new FileCollection();

	fileCollection.on("add", function (file) {
		if (typeof (file.get("raw_url")) !== 'undefined') {
			var url = file.get("raw_url") + '?' + globalKey;
			$.ajax({
				url: url,
				type: 'GET',
			}).done(function (response) {
				file.set("content", response);
				files.render();
				$('pre code').each(function (i, block) {
					hljs.highlightBlock(block);
				});
			});
		}
	});

	var gists = new GistCollection();

	var fileTypeSummary = new Backbone.Collection();

	var fileTypeModel = Backbone.Model.extend({
		defaults: {
			language: ""
		}
	});

	fileTypeSummary.model = fileTypeModel;

	fileTypeSummary.comparator = function (model) {
		var value = model.get('language')
		if (value !== null) {
			value = value.toUpperCase()
		}
		return -value;
	};

	var tagSummary = new Backbone.Collection();

	var tagModel = Backbone.Model.extend({
		defaults: {
			tag: "",
			length: 0
		}
	});
	var tagViewSummary = new Backbone.Collection();

	tagViewSummary.model = tagModel

// 	tagViewSummary.comparator = function (model) {
// 		return -model.get('tag');
// 	}

	var modelTaggin = function (model) {
		_.forEach(model.get('files'), function (file) {
			var exist = model.get('language');
			model.set('language', " " + file.language + " " + exist);
			fileTypeCollection.add(file);
		});

		var des = model.get('description');
		var tagSplit = des.split("##");
		tagSplit.shift();
		var tagArray = [];
		tagSplit.forEach(function (str) {
			var part = str.split(" ");
			tagArray.push(part[0].toLowerCase());
		});
		model.set('tags', tagArray.join(" "));
		model.set('cleanUpdateDate', (new Date(model.get('updated_at')).yyyymmdd()));
		model.set('intUpdateDate', (new Date(model.get('updated_at')).toInt()));
	};

	gists.on("add", function (model) {
		modelTaggin(model);
	});

	var filtersAndTags = function () {
		var fileTypeCollectionGrp = fileTypeCollection.groupBy(function (model) {
			return model.get('language');
		});
		fileTypeSummary.reset();
		fileTypeSummary.add({
			"language": "All gists",
			"length": ""
		});
		_.forEach(fileTypeCollectionGrp, function (model) {
			fileTypeSummary.add({
				"language": model[0].attributes.language || null,
				"length": model.length
			});
		});

		var fileTypeSummaryNull = fileTypeSummary.find({
			"language": null
		});
		if (typeof (fileTypeSummaryNull) !== "undefined") {
			fileTypeSummaryNull.destroy();
		}

		var tagCollectionGrp = gists.groupBy(function (model) {
			return model.get('tags');
		});
		tagSummary.reset();
		_.forEach(tagCollectionGrp, function (model) {
			var modelTags = (model[0].get("tags")).split(" ");
			_.forEach(modelTags, function (tag) {
				tagSummary.add({
					"tag": tag || null
				});
			});
		});
		(tagSummary.find({
			"tag": null
		})).destroy();

		tagViewSummary.reset();
		_.forEach(tagSummary.models, function (tag) {
			tag = tag.get('tag')
			var filter = function (child, index, collection) {
				return child.get('tags').toLowerCase().indexOf(tag) >= 0;
			}
			var results = gists.filter(filter);
			
			if(typeof(tagViewSummary.findWhere({ 'tag':tag}))=== 'undefined'){
  			tagViewSummary.add({
  				"tag": tag,
  				"length": results.length
  			});
			}
			
			
			
			
		});

	}

	gists.on('sync', filtersAndTags);
	// 	gists.on('add', filtersAndTags);

	// 	gists.on('taggin',filtersAndTags);

	var len = gists.length;
	var i = 1;
	var fetchLooper = function (callback) {
		gists.fetch({
			data: {
				page: i
			},
			remove: false,
			success: function () {
				if (gists.length === len) {
					// console.warn('Collection is NOT increasing')
				} else {
					i++;
					fetchLooper();
				}
				len = gists.length;
			},
			error: function () {
				console.log('error');

			}
		})
	}
	fetchLooper();

	var ChildView = Marionette.View.extend({
		template: '#item',
		className: "list-group-item",
		tagName: 'li',
		events: {
			"click": "clicked"
		},
		initialize: function () {
			this.listenTo(this.model, 'change', this.render);
		},
		clicked: function () {
			$('.sidebar-nav .active').removeClass('active');
			settings.mode = "view"
			this.$el.addClass('active');
			fileCollection.reset();

			// 	orginalFiles = _.clone(this.model.get("files"));

			_.forEach(this.model.get("files"), function (file) {
				fileCollection.add(file)
				// console.log("files:", "=============", file);
			});
			gist.model = this.model;
			gist.render();
		}
	});

	var MyEmptyGistCollectionView = Marionette.View.extend({
		// template: '#item',
		className: "list-group-item",
		tagName: 'li',
		template: _.template('Loading....')
	});

	var CollectionView = Marionette.CollectionView.extend({
		className: "sidebar-nav list-group",
		tagName: 'ul',
		childView: ChildView,
		collection: gists,
		reorderOnSort: true,
		viewComparator: -'intUpdateDate',
		emptyView: MyEmptyGistCollectionView
	});

	var gistList = new CollectionView();
	gistList.render();

	var fileView = Marionette.View.extend({

		onBeforeRender: function () {

			// 	console.log(this.template)
			tmp = '#file'
			if (settings.mode !== "view" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-edit-file'
			}
			this.template = tmp

			if (this.model.get('deleteFlag') === true) {
				this.$el.hide()
			} else {
				this.$el.show()
			}

		},

		template: '#file',
		tagName: 'li',
		ui: {
			copy: '.copy',
			send: '.send-gist',
			fileName: '.fileName',
			codeEditor: 'textarea',
			deleteFile: '.deleteFile'
		},
		events: {
			"click @ui.copy": "copy",
			"click @ui.send": "send",
			"click @ui.deleteFile": "flagForDelete"
		},

		copy: function () {
			function setClipboard(value) {
				var tempInput = document.createElement("textarea");
				tempInput.style = "position: absolute; left: -1000px; top: -1000px";
				tempInput.value = value;
				document.body.appendChild(tempInput);
				tempInput.select();
				document.execCommand("copy");
				document.body.removeChild(tempInput);
			}
			setClipboard(this.model.get('content'));

		},
		
    send: function(){
      var filename = this.model.get('filename');
      var content = this.model.get('content');
      var subjectPrefix = "";
      var messagePrefix = "I've attached the " +  filename +  " gist from my collection for you, please see below. \n \n \n";
      var messagePost = "\n \n \n Hope it helps! \n \n Sent via https://www.gistyapp.com an open source gist manager.";
      // Thanks
      // https://stackoverflow.com/questions/10219781/javascript-adding-linebreak-in-mailto-body
      content = messagePrefix + content + messagePost;
      content = encodeURIComponent(content);
      filename = subjectPrefix + filename + " gist";
      window.open('mailto:?subject='+filename+'&body='+content);
    },
		
		
		change: function () {
			settings.mode = 'edit'
			this.template = '#template-edit-file';
			this.render();
			this.delegateEvents()
		},
		displayView: function () {
			settings.mode = 'view'
			this.template = '#file';
			this.render()
			this.delegateEvents()
		},
		updateCode: function () {
			if (this.ui.fileName !== '.fileName' && this.model.get('flagForDelete') !== true) {
				// console.log('saving file')
				// console.log(this.model)
				this.model.set("filename", this.ui.fileName.val());
				this.model.set("content", this.ui.codeEditor.val());
			}
		},
		flagForDelete: function () {
			if (typeof (this.model.get('size')) !== "undefined") {
				// console.log('existing')
				this.model.set('deleteFlag', true)
				filesToDelete.push(_.clone(this.model.get('filename')));
				this.$el.hide()
			} else {
				// console.log('new')
				this.model.destroy();
			}
		}
	});

	var filesView = Marionette.CollectionView.extend({
		className: "list-group",
		tagName: 'ul',
		childView: fileView,
		collection: fileCollection,
		initilize: function () {
			settings.mode = 'view'
		}
	});

	var files = new filesView();
	files.render();

	var languageView = Marionette.View.extend({
		template: '#language-template',
		className: 'list-group-item',
		tagName: 'li',
		events: {
			"click": "filter"
		},
		filter: function () {
			$('.language-wrapper .active').removeClass('active');
			this.$el.addClass('active');
			var currentLanguage = this.model.get('language');

			var filter = function (child, index, collection) {
				return child.get('language').indexOf(" " + currentLanguage + " ") >= 0;
			};

			if (currentLanguage === 'All gists') {

				gistList.removeFilter({
					preventRender: true
				});
			} else {
				gistList.setFilter(filter, {
					preventRender: true
				});
			}
			gistList.render();

		}
	});

	var languagesView = Marionette.CollectionView.extend({
		className: "list-group",
		tagName: 'ul',
		childView: languageView,
		collection: fileTypeSummary,
		emptyView: MyEmptyGistCollectionView,
		reorderOnSort: true,
		viewComparator: 'language',
	});

	var languages = new languagesView();
	languages.render();

	fileTypeSummary.bind("add", function () {
    // I know this not ideal, but it works for now
		setTimeout(function () {
			languages.render();
		}, 100)
	});

	var SearchView = Marionette.View.extend({
		template: '#search-template',
		tagName: 'form',
		className: 'form-inline',
		ui: {
			searchBTN: '.searchBTN',
			newGist: '.new-gist',
			searchInput: '.searchInput'
		},
		events: {
			"click @ui.searchBTN": "filter",
			"click @ui.newGist": "newGist",
			'keypress @ui.searchInput': 'preventEnter'
		},

		preventEnter: function (e) {
			if (e.which === 13) {
				e.preventDefault();
				this.filter(e)
			}
		},

		filter: function (e) {
			e.preventDefault();
			var searchValue = this.ui.searchInput.val();
			$('.language-wrapper .active').removeClass('active');

			var filter = function (child, index, collection) {
				return (child.get('description').toLowerCase()).indexOf(searchValue.toLowerCase()) >= 0;
			};
			gistList.setFilter(filter, {
				preventRender: true
			});
			gistList.render();
		},

		newGist: function () {
			// 	console.log('new clicked');

			fileCollection.reset();

			gist.newView()

		}
	});

	var searchView = new SearchView();
	searchView.render();

	var tagView = Marionette.View.extend({
		template: '#tag-template',
		tagName: 'li',
		className: "list-group-item",
		events: {
			"click": "filter"
		},
		filter: function () {
			$('.language-wrapper .active').removeClass('active');
			this.$el.addClass('active');
			var currentTags = this.model.get('tag');
			var filter = function (child, index, collection) {
				return child.get('tags').indexOf(currentTags) >= 0;
			};

			// console.log(filter())
			gistList.setFilter(filter, {
				preventRender: true
			});

			gistList.render();

		}
	});

	var tagsView = Marionette.CollectionView.extend({
		className: "list-group",
		tagName: 'ul',
		childView: tagView,
		collection: tagViewSummary,
		emptyView: MyEmptyGistCollectionView,
		reorderOnSort: true,
		viewComparator: 'tag'
	});

	var tags = new tagsView()
	tags.render();

// window.tags = tags;

	var detailView = Marionette.View.extend({
		ui: {
			edit: '.edit-gist',
			deleteGists: '.deleteGists',
			save: '.save-gist',
			cancel: '.cancel-gist',
			cancelNew: '.cancel-gist-new',
			add: '.add-gist',
			desc: 'textarea.description'
		},
		events: {
			"click @ui.edit": "editView",
			"click @ui.deleteGists": "deleteGists",
			"click @ui.save": "saveView",
			"click @ui.cancel": "readView",
			"click @ui.cancelNew": "cancelView",
			"click @ui.add": "addGist",
			"click @ui.cancel": "readView",
			"click @ui.cancelNew": "cancelView",
			"click @ui.add": "addGist"
		},

		template: '#details',

		onBeforeRender: function () {
			// console.log('------========------=====-----')
			// console.log(settings.mode)
			tmp = '#template-initial-load'
			// 	tmp = _.template('Nothing to display.')
			// 	console.log(this.template)
			if (settings.mode === "edit" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-edit-details'
			}
			if (settings.mode === "new" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-new-details'
			}
			if (settings.mode === "loading" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-loading'
			}
			if (settings.mode === "view" && typeof (settings.mode) !== "undefined") {
				tmp = '#details'
			}
			// console.log(tmp)
			this.template = tmp
		},

		editView: function () {
			// 	this.template = '#template-edit-details';
			settings.mode = "edit";

			orginalFiles = _.clone(this.model.get("files"));

			this.render();
			// 	this.status = "editMode"
			_.forEach(files.children._views, function (childView) {
				childView.change()
			});
		},


		newView: function () {
			// 	this.template = '#template-edit-details';
			settings.mode = "new";
			fileCollection.reset();
			this.render();
			this.addGist();
		},

		deleteGists: function () {
			// 	this.template = '#template-edit-details';
			// console.warn('deleting the gist id: ',this.model.get('id'))

			var conf = confirm('About to delete. Proceed?')

			if (conf === true) {
				this.model.destroy();
				this.$el.html('<h1>Deleted the gist</h1>');
				gistList.$el.find('li').first().click();
			}

		},

		cancelView: function () {
			// 	this.template = '#details';
			settings.mode = "view";
			gistList.$el.find('li').first().click();
		},
		readView: function () {
			// 	this.template = '#details';
			settings.mode = "view";
			// fileView.template= '#file';
			this.render();
			// 	this.status = "viewOnly"

			// remove delete flage if applicable for the files
			fileCollection.forEach(function (model) {
				model.set('deleteFlag', false);
			});

			_.forEach(files.children._views, function (childView) {

				childView.displayView()
			});

			$('pre code').each(function (i, block) {
				hljs.highlightBlock(block);
			});

		},

		loadView: function () {
			// 	this.template = '#details';
			settings.mode = "loading";
			// fileView.template= '#file';
			this.render();
			// 	this.status = "viewOnly"
		},

		saveView: function () {
			// console.log('save button');
			// console.log(this.ui.desc.val());

			var desc = this.ui.desc.val();

			if (settings.mode !== "new") {
				this.model.set("description", desc)
				_.forEach(files.children._views, function (childView) {
					childView.updateCode()
				});
				this.model.save();
				this.readView();
			} else {

				// console.log('new item')

				_.forEach(files.children._views, function (childView) {
					childView.updateCode()
				});

				// console.log(fileCollection)

				//THANKS https://stackoverflow.com/questions/14942592/backbone-collection-create-success

				this.loadView();
				var dateInt = new Date().toInt();
				var newGist;
				newGist = gists.create({
					'description': desc,
					'intUpdateDate': dateInt
				}, {
					success: function () {
						// console.log(newGist);
						// console.log(newGist.get('id'));
						newGist.set({
							'intUpdateDate': dateInt
						})
						gistList.$el.find('li').first().click();
						// do some stuff here
						// this.readView();
					}
				});

			}

			// 	this.readView();

			// fileCollection.models[0].set('deleteFlag',true)

		},

		addGist: function () {
			// 	console.log('add button');
			fileCollection.add({
				"filename": "_" + new Date() + ".txt",
				content: "Some awesome Code"
			})
		},

		onRender: function () {
			this.$el.find('.files').append(files.el);
		}

	});

	var gist = new detailView();
	gist.render()

	$("#list").html(gistList.el);
	$("#content").html(gist.el);
	$("#language").html(languages.el);
	$("#tags").html(tags.el);
	$(".searchbox").html(searchView.el);

// 	window.gist = gist;
// 	window.gists = gists;
// 	window.fileCollection = fileCollection;
// 	window.files = files;
// 	window.gistList = gistList;
// 	window.tagSummary = tagSummary;
// 	window.tagViewSummary = tagViewSummary;
// 	window.filtersAndTags = filtersAndTags;
}

var APIkey = localStorage.getItem("gistyAPIKey") || "";
var themeColor = localStorage.getItem("gistyTheme") || "";


// Thanks
// https://stackoverflow.com/questions/7846980/how-do-i-switch-my-css-stylesheet-using-jquery
var themeDark = function(){
   $('link[href="bootstrap.light.min.css"]').attr('href','bootstrap.dark.min.css');
   $('link[href="light.css"]').attr('href','dark.css');
   $('link[href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/github.min.css"]').attr('href','https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/railscasts.min.css');
   localStorage.setItem("gistyTheme", "dark");
}
var themeLight = function(){
   $('link[href="bootstrap.dark.min.css"]').attr('href','bootstrap.light.min.css');
   $('link[href="dark.css"]').attr('href','light.css');
   $('link[href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/railscasts.min.css"]').attr('href','https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/github.min.css');
   localStorage.setItem("gistyTheme", "light");
   
}

var setup = function () {
	var pass = prompt('Please enter you GitHub API key');
	if (typeof (pass) !== 'undefined' && pass !== null) {
		localStorage.setItem("gistyAPIKey", pass);
		APIkey = localStorage.getItem("gistyAPIKey")
		$('.sidebar-wrapper, .language-wrapper').show()
  	$("#page-content-wrapper").css('margin-left','550px');
		app();

	} else {
		alert("No API key found, please refresh and enter your API key to use the application")
	}
}

$(document).ready(function() {

  $('#dark').click(function (){
    themeDark()
  });
  
  $('#light').click(function (){
    themeLight()
  });
  
  if (typeof (APIkey) === "undefined" || APIkey === null || APIkey === "" || APIkey === "null") {
  	// Moved to below
  	$('.sidebar-wrapper, .language-wrapper').hide()
  	$("#page-content-wrapper").css('margin-left','50px');
  } else {
    if(themeColor === "light"){
      themeLight()
    } else {
      localStorage.setItem("gistyTheme", "dark");
    }
    $('.sidebar-wrapper, .language-wrapper').show()
    $("#page-content-wrapper").css('margin-left','550px');
  	app();
  }
  
});