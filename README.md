# Eventbrite Availability Checker
Check Eventbrite for availability of tickets and send a text message when they become available.

### Note
This only works for [Eventbrite.co.uk](https://eventbrite.co.uk "Eventbrite.co.uk") events. Text alerts are send using [Twilio](https://www.twilio.com/ "Twilio"),  leave any of the API credentials empty in the config file (.env) to disable this feature.

## Getting started
1. Download the repo, navigate into the directory with the terminal and install the dependancies:
``npm install``

2. Make the apporiate edits in the *.env* config file

3. Once ready, start the script with:
``
npm start
``

### How to find an event's id
The event id needs to be set in the config file and can be found by visiting the event's web page and looking into the URL for a series of digits at the end of the main URL.

![How to find an event's id](https://i.imgur.com/mbRkhK7.png "How to find an event's id")
