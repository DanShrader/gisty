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
		mode: "view"
	}

	var globalKey = APIkey;

	$.ajaxSetup({
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
		// url: urlWithKey('https://api.github.com/gists', globalKey),
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
			// var opts = _.extend({url: '/destroy/' + this.id}, options || {});

			var alteredUrl = this.get("url") + '?access_token=' + globalKey;
			// console.log(alteredUrl);
			// console.log(this.id);
			// console.log(this);
			var opts = _.extend({
				url: alteredUrl
			});

			// console.warn('the destroy ovveride called');
			// console.warn(options);
			// console.warn(attrs);
			return Backbone.Model.prototype.destroy.call(this, opts);
			// return Backbone.Model.prototype.destroy.call();
		},

		// Overwrite save function
		save: function (attrs, options) {
			modelTaggin(this);
			options || (options = {});
			attrs || (attrs = _.clone(this.attributes));
			// console.warn(attrs);
			var newFiles = {};
			_.forEach(fileCollection.models, function (model) {
				if (typeof (model) !== 'undefined') {

					if (model.get('deleteFlag') === true) {
						newFiles[model.get('filename')] = {};
						model.destroy();
					} else {

						// if the file is renamed need to pass a blank object to remove
						// https://developer.github.com/v3/gists/#edit-a-gist

						// attrs.id is catching the 'new' items
						if (model.get('nameChange') !== 'false' && attrs.id !== null) {
							// 	console.warn('name change', model);
							newFiles[model.get('nameChange')] = {};
						}

						newFiles[model.get('filename')] = {
							'content': model.get('content'),
							'language': model.get('language')
						};

					}

				}
			});
			// 	console.log('newFiles');
			// 	console.log(newFiles);
			// 	console.log('newFiles');

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
			options.data = JSON.stringify(attrs);

			// 	console.log(options);

			// Proxy the call to the original save function
			return Backbone.Model.prototype.save.call(this, attrs, options);
		}

	});

	var GistCollection = Backbone.Collection.extend({
		model: model,
		url: 'https://api.github.com/gists'
	});

	var file = Backbone.Model.extend({
		defaults: {
			content: "",
			deleteFlag: false,
			nameChange: 'false'
		},
		initialize: function () {
			this.collection.on("change:filename", function () {
				this.set('nameChange', this.previous('filename'));
			}, this);
		}
	});

	var FileCollection = Backbone.Collection.extend({
		model: file
	});

	var fileCollection = new FileCollection();
	var fileTypeCollection = new FileCollection();

	fileCollection.on("add", function (file) {
		// console.warn("Ahoy " + file.get("filename") + "!");

		if (typeof (file.get("raw_url")) !== 'undefined') {

			var url = file.get("raw_url") + '?' + globalKey;
			// console.warn(url);

			$.ajax({
				url: url,
				type: 'GET',
			}).done(function (response) {
				// console.log(response);
				file.set("content", response);
				files.render();
				$('pre code').each(function (i, block) {
					hljs.highlightBlock(block);
				});
				// https://highlightjs.org/
			});

		}

	});

	var gists = new GistCollection();

	var fileTypeSummary = new Backbone.Collection();
	var tagSummary = new Backbone.Collection();
	var tagViewSummary = new Backbone.Collection();

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
			tagArray.push(part[0]);
		});
		model.set('tags', tagArray.join(" "));
		model.set('cleanUpdateDate', (new Date(model.get('updated_at')).yyyymmdd()));
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

		tagCollectionGrp = tagSummary.groupBy(function (model) {
			return model.get('tag');
		});

		tagViewSummary.reset();

		_.forEach(tagCollectionGrp, function (model) {
			// console.log(model)
			tagViewSummary.add({
				"tag": model[0].attributes.tag || null,
				"length": model.length
			});
		});

	}

	gists.on('sync', filtersAndTags);
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
			_.forEach(this.model.get("files"), function (file) {
				fileCollection.add(file)
			});
			gist.model = this.model;
			gist.render();
		}
	});

	var CollectionView = Marionette.CollectionView.extend({
		className: "sidebar-nav list-group",
		tagName: 'ul',
		childView: ChildView,
		collection: gists,
		reorderOnSort: true
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
			fileName: '.fileName',
			codeEditor: 'textarea',
			deleteFile: '.deleteFile'
		},
		events: {
			"click @ui.copy": "copy",
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
			// 	console.log('model is:')
			// 	console.log(this.model.attributes)
			// 	console.log('filename is:')
			// 	console.log(this.ui.fileName.val())
			// 	console.log('code is:')
			// 	console.log(this.ui.codeEditor.val())
			// 	console.log(this.ui.fileName)
			//  Need incase the file is flagged for deletion
			if (this.ui.fileName !== '.fileName') {
				this.model.set("filename", this.ui.fileName.val());
				this.model.set("content", this.ui.codeEditor.val());
			}

		},
		flagForDelete: function () {
			this.model.set('deleteFlag', true);

			this.$el.hide()

			// 	this.destroy();
		}
	});

	var filesView = Marionette.CollectionView.extend({
		className: "",
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
		className: "",
		tagName: 'ul',
		childView: languageView,
		collection: fileTypeSummary
	});

	var languages = new languagesView();
	languages.render();

	var SearchView = Marionette.View.extend({
		template: '#search-template',
		tagName: 'form',
		className: 'form-inline',
		ui: {
			searchBTN: '.btn',
			newGist: '.new-gist',
			searchInput: '.form-control'
		},
		events: {
			"click @ui.searchBTN": "filter",
			"click @ui.newGist": "newGist"
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
		className: "",
		tagName: 'ul',
		childView: tagView,
		collection: tagViewSummary
	});
	var tags = new tagsView()
	tags.render();

	var detailView = Marionette.View.extend({
		// status: "viewOnly",

		ui: {
			edit: '.edit-gist',
			deleteGists: '.deleteGists',
			save: '.save-gist',
			cancel: '.cancel-gist',
			add: '.add-gist',
			desc: 'textarea.description'
		},
		events: {
			"click @ui.edit": "editView",
			"click @ui.deleteGists": "deleteGists",
			"click @ui.save": "saveView",
			"click @ui.cancel": "readView",
			"click @ui.add": "addGist"
		},

		template: '#details',

		onBeforeRender: function () {
			// 	console.log(this.template)
			tmp = '#details'
			if (settings.mode !== "view" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-edit-details'
			}
			if (settings.mode === "new" && typeof (settings.mode) !== "undefined") {
				tmp = '#template-new-details'
			}
			this.template = tmp
		},

		editView: function () {
			// 	this.template = '#template-edit-details';
			settings.mode = "edit";
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
			}

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

		},

		saveView: function () {
			// console.log('save button');
			// console.log(this.ui.desc.val());

			if (settings.mode !== "new") {
				this.model.set("description", this.ui.desc.val())
				_.forEach(files.children._views, function (childView) {
					childView.updateCode()
				});
				this.model.save();
			} else {

				// console.log('new item')

				_.forEach(files.children._views, function (childView) {
					childView.updateCode()
				});

				// console.log(fileCollection)

				//THANKS https://stackoverflow.com/questions/14942592/backbone-collection-create-success
				var newGist;
				newGist = gists.create({
					'description': this.ui.desc.val()
				}, {
					success: function () {
						// console.log(newGist);
						// console.log(newGist.get('id'));
						// do some stuff here
					}
				});

			}

			this.readView();

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
			// console.warn(fileCollection.length)
			// 	this.el.append(files.el);

			this.$el.find('.files').append(files.el);
		}

	});

	var gist = new detailView();

	$("#list").html(gistList.el);
	$("#content").html(gist.el);
	$("#language").html(languages.el);
	$("#tags").html(tags.el);
	$(".searchbox").html(searchView.el);

	window.gist = gist;
	window.gists = gists;
	window.fileCollection = fileCollection;
	window.files = files;
	window.gistList = gistList;
}

var APIkey = localStorage.getItem("gistyAPIKey") || "";

if (typeof (APIkey) === "undefined" || APIkey === null || APIkey === "" || APIkey === "null") {
	var pass = prompt('Please enter you GitHub API key');
	if (typeof (pass) !== 'undefined' && pass !== null) {
		localStorage.setItem("gistyAPIKey", pass);
		APIkey = localStorage.getItem("gistyAPIKey")
		app();

	} else {
		alert("No API key found, please refresh and enter your API key to use the application")
	}

} else {
	app();
}