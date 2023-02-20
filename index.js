//Packages
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const twilio = require('twilio');
const clc = require('cli-color');

//Load config
require('dotenv').config();
let useTwilio = process.env.NOTIFY_NUMBER !== "" && process.env.TWILIO_ACCOUNT_SID !== "" && process.env.TWILIO_AUTH_TOKEN !== "" && process.env.TWILIO_FROM_NUMBER !== "";

//Constants
const eventbrite_base_url = "https://www.eventbrite.co.uk/checkout-external?eid=";

//When the last text message (stops duplicate messages)
let lastTextMessageTimestamp = 0;

//Twilio client
let twilioClient;
if(useTwilio){
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

//Main loop
console.log("Checking for tickets every " + process.env.CHECK_INTERVAL + " seconds...");
setInterval(async function () {
    //Print divider
    console.log('-'.repeat(process.stdout.columns));

    //Get ticket statuses
    let ticketStatuses = await getTicketStatuses();

    //Print ticket statuses
    printTicketStatus(ticketStatuses);
}, process.env.CHECK_INTERVAL * 1000);


//Print ticket statuses
function printTicketStatus(tickets) {
    tickets.forEach((ticket) => {
        let statusColour = clc.green;

        //Set colour based on status
        switch(ticket.status.toLowerCase()){
            case "sold out":
                statusColour = clc.red;
                break;
            case "waitlist":
                statusColour = clc.yellow;
                break;
            case "on sale":
            default:
                statusColour = clc.green;
                break;
        }

        //Highlight if ticket is desired ticket
        if(ticket.title === process.env.TICKET_NAME){
            //Print ticket title and status highlighted
            console.log('⌄'.repeat(process.stdout.columns));
            console.log(clc.bold(statusColour(ticket.status) + " - " + ticket.title));
            console.log('⌃'.repeat(process.stdout.columns));
        } else {
            //Print ticket title and status
            console.log(statusColour(ticket.status) + " - " + ticket.title);
        }
    });
}

//Send text message via Twilio to notify of ticket availability
function sendTextMessage(message) {
    //Skip if Twilio is not enabled
    if(!useTwilio) return;

    //Skip if too soon since last text message
    const now = new Date().getTime();
    if(process.env.MIN_TEXT_INTERVAL !== 0 && lastTextMessageTimestamp + process.env.MIN_TEXT_INTERVAL > now){
        console.log("Skipping text message as too soon since last text message...\n");
        return;
    };

    //Console log
    console.log("Sending text message.../n");

    //Send text message
    twilioClient.messages.create({
        body: message,
        to: process.env.NOTIFY_NUMBER, // Text this number
        from: process.env.TWILIO_FROM_NUMBER, // From a valid Twilio number
    });

    //Update last text message timestamp
    lastTextMessageTimestamp = now;
}

//Get ticket statuses
async function getTicketStatuses() {
    let tickets = [];
    let eventName = "Event";
    let desiredTicketAvailable = false;
    let anyTicketAvailable = false;
    
    //Console log
    console.log(new Date().toUTCString());
    console.log("Getting ticket statuses...");

    //Start browser
    const browser = await puppeteer.launch({
        headless: true
    });

    //Open new page
    const page = await browser.newPage();

    //Go to event's EventBrite webpage
    let response = await page.goto(eventbrite_base_url + process.env.EVENT_ID, {
        waitUntil: "networkidle0",
    });

    //Handle bad responses
    const responseStatus = response.status();
    if(responseStatus !== 200){
        console.error("Error: Bad response from EventBrite (" + responseStatus + ")");
        process.exit();
    }

    //Get page title
    const pageTitle = await page.title();
    if(pageTitle !== ""){
        eventName = pageTitle.replace('Eventbrite | ','');
    }
    
    //Get page content as HTML string
    const content = await page.content();

    //Load content into cheerio
    const $ = cheerio.load(content);

    //Get tickets
    $(".eds-card-list .eds-card-list__item").each((i, el) => {
        let ticketTitle = $(el).find(".ticket-title-container .ticket-title").text();
        let ticketStatus = $(el).find(".ticket-status").text();

        //Webpage uses a different structure
        if(ticketStatus === ""){
            //Check if ticket has a waitlist
            if($(el).find(".eds-ticket-card-content__join-waitlist-button").length > 0){
                ticketStatus = "Waitlist";
            }

            //Uses card structure
            if($(el).find(".eds-card").length > 0){
                ticketTitle = $(el).find(".eds-card .ticket-display-card-content-full-size__ticket-name").text();

                //Set default status
                ticketStatus = "On Sale";

                //Check if ticket is sold out
                $(el).find(".eds-card .eds-stepper-button[disabled]").each((i, el) => {
                    if(i === 1){
                        ticketStatus = "Sold Out";
                    }
                });

                //A ticket is available is on sale
                if(ticketStatus === "On Sale"){
                    anyTicketAvailable = true;
                }
            }
        } else if (ticketStatus !== "Sold out") {
            //A ticket is available is on sale
            anyTicketAvailable = true;
        }

        //Add ticket to array
        tickets.push({
            title: ticketTitle,
            status: ticketStatus
        });

        //Check if desired ticket
        if(ticketTitle === process.env.TICKET_NAME && ticketStatus === "On Sale"){
            desiredTicketAvailable = true;
        }
    });

    //Console log results
    console.log("Results: " + tickets.length + " tickets found\n");

    //Notify if desired/all ticket is available
    if(process.env.TICKET_NAME !== "" && desiredTicketAvailable){
        //Send text message
        sendTextMessage("TICKETS AVAILABLE: " + process.env.TICKET_NAME + " are available for " + eventName + "!");
    } else if(process.env.TICKET_NAME === "" && tickets.length > 0 && anyTicketAvailable){
        //Send text message
        sendTextMessage("TICKETS AVAILABLE: " + eventName + " has tickets available!");
    }

    //Close browser
    await browser.close();

    //Return tickets
    return tickets;
}