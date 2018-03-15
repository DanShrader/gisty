# gisty~

This is a GitHub gist interface, with lots of filters, search, and is not very chatty.

You can launch the app [here](https://www.gistyapp.com) or by browsing to https://www.gistyapp.com

![screenshot](screenshot.png  "Screenshot")

## Work in progress!

To use the tagging feature put a double hash tag in front of a word in the description and they'll show up.

**Example:** ##tag or ##JavaScript

The cool thing about this app it the ***all*** of the data is stored in GitHub so you can access all the information of the gist from your favorite integrations.

**Note:** To start using this app you'll need to generate a GitHub API key and enter it the first time at the prompt. The reason for this is we don't want to run a node server for API authentication. It saves the key to your local storage so you don't have to keep entering it. The team never see's it, cannot access it, and it is local to your machine.

## History / Backstory

With my favorite online gist editor going away and its replacement not syncing to GitHub I figured while waiting for hurricane Irma to pass I'd write up a quick replacement for myself. After writing most of it I thought to  share it for those in similar situations.

You can create one [here](https://github.com/settings/tokens) on your GitHub account.

### Todo

* [X] Get the editor functions working
* [ ] Multi word search
* [X] Possibly using local storage / syncing for offline access
* [X] Make the empty place holders have messages for empty
* [X] Better setup tutorial
* [X] Make cool logo
* [X] UI Clean up

### Thanks

* To the many StackOverflow posts with the tidbits that I needed
* GitHub
* jQuery
* Backbone
* Marionette
* Bootstrap
* highlight.js
* https://bootswatch.com/
* Anyone else that I may have missed
