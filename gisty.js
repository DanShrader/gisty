var app = function () {

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
				console.info("id this is a patch");
				model.url = urlWithKey('https://api.github.com/gists/' + model.get('id'), globalKey);
			} else {
				console.info("no id");
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
			html_url: null,
			updated_at: null,
			language: "",
			tags: " "
		},
		// Overwrite save function
		save: function (attrs, options) {
			options || (options = {});
			attrs || (attrs = _.clone(this.attributes));
			_.forEach(attrs.files, function (file) {
				delete file.filename;
				delete file.raw_url;
				delete file.type;
				delete file.size;
				file.content = 'tmp stuff';
			});
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
			options.data = JSON.stringify(attrs);
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
			raw_code: ""
		}
	});

	var FileCollection = Backbone.Collection.extend({
		model: file,
	});

	var fileCollection = new FileCollection();
	var fileTypeCollection = new FileCollection();

	fileCollection.on("add", function (file) {
		// console.warn("Ahoy " + file.get("filename") + "!");
		var url = file.get("raw_url") + '?' + globalKey;
		// console.warn(url);
		$.ajax({
			url: url,
			type: 'GET',
		}).done(function (response) {
			// console.log(response);
			file.set("raw_code", response);
			files.render();
			$('pre code').each(function (i, block) {
				hljs.highlightBlock(block);
			});
			// https://highlightjs.org/
		});

	});

	var gists = new GistCollection();

	var fileTypeSummary = new Backbone.Collection();
	var tagSummary = new Backbone.Collection();
	var tagViewSummary = new Backbone.Collection();

	gists.on("add", function (model) {
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
	});

	gists.on('sync', function () {
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

	});

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
		clicked: function () {
			$('.sidebar-nav .active').removeClass('active');
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
		collection: gists
	});

	var gistList = new CollectionView();
	gistList.render();

	var fileView = Marionette.View.extend({
		template: '#file',
		ui: {
			copy: '.copy'
		},
		events: {
			"click @ui.copy": "copy"
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
			setClipboard(this.model.get('raw_code'));

		}
	});

	var filesView = Marionette.CollectionView.extend({
		className: "",
		tagName: 'ul',
		childView: fileView,
		collection: fileCollection
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
			searchInput: '.form-control'
		},
		events: {
			"click @ui.searchBTN": "filter"
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
		template: '#details',
		onRender: function () {
			// console.warn(fileCollection.length)
			this.el.append(files.el);
		}

	});

	var gist = new detailView();

	$("#list").html(gistList.el);
	$("#content").html(gist.el);
	$("#language").html(languages.el);
	$("#tags").html(tags.el);
	$(".searchbox").html(searchView.el);
	
	
	window.gists = gists;
	
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