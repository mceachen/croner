
/* ------------------------------------------------------------------------------------

  Croner - MIT License - Hexagon <github.com/Hexagon>

  Pure JavaScript Isomorphic cron parser and scheduler without dependencies.

  ------------------------------------------------------------------------------------
  
  Pattern:
    ```
	┌──────────────── sec (0 - 59)
	| ┌────────────── min (0 - 59)
	| │ ┌──────────── hour (0 - 23)
	| │ │ ┌────────── day of month (1 - 31)
	| │ │ │ ┌──────── month (1 - 12)
	| │ │ │ │ ┌────── day of week (0 - 6) 
	| │ │ │ │ │       (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
	| │ │ │ │ │
	* * * * * * ```

  ------------------------------------------------------------------------------------

  License:

    MIT:

	Copyright (c) 2015 Hexagon <github.com/Hexagon>

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.

  ------------------------------------------------------------------------------------  */

function raise (err) {
	throw new TypeError('Cron parser: ' + err);
}
 
function partToArray (type, arr, conf, valueIndexOffset) {

	var i,x,
		confParts,
		split,
		index,
		lower,
		upper;
 
	// First off, handle wildcard
	if (conf === '*' ) {
		for (i = 0; i < arr.length; i++) {
			arr[i] = 1;
		}

		return;
	}
 
	// Check if we need to split
	confParts = conf.split(',');
 
	// Recurse into comma separated entries
	if (confParts.length > 1) {
		for (i = 0; i < confParts.length; i++) {
			partToArray(type, arr, confParts[i], valueIndexOffset);
		}
	
		return;
	}
 
	// Didn't need to recurse, determine if this is a range or a number
	if (conf.indexOf('-') === -1) {
		// Got a number
		index = (parseInt(conf, 10) + valueIndexOffset);

		if (index < 0 || index >= arr.length) {
			raise(type + ' value out of range: "' + conf + '"');
		}

		arr[index] = 1;
	} else {

		// Got a range
		split = conf.split('-');

		if (split.length !== 2) {
			raise('syntax error, illegal range: "' + conf + '"');
		}

		lower = parseInt(split[0], 10) + valueIndexOffset;
		upper = parseInt(split[1], 10) + valueIndexOffset;

		if (isNaN(lower)) {
			raise('syntax error, illegal lower range (NaN)');
		} else if (isNaN(upper)) {
			raise('syntax error, illegal upper range (NaN)');
		}

		//
		if (lower < 0 || upper >= arr.length) {
			raise('value out of range: "' + conf + '"');
		}

		//
		if (lower > upper) {
			raise('from value is larger than to value: "' + conf + '"');
		}

		for (x = lower; x <= upper; x++) {
			arr[(x + valueIndexOffset)] = 1;
		}
	}
}

function parsePattern(pattern, target) {

	// Sanity check
	if (typeof pattern !== 'string') {
		raise('invalid configuration string ("' + pattern + '").');
	}

	// Split configuration on whitespace
	var parts = pattern.trim().replace(/\s+/g, ' ').split(' '),
		part,
		i,
		reValidCron = /[^0-9,-]+/,
		hasMonths,
		hasDaysOfWeek,
		hasDates,

		seconds,
		minutes,
		hours,
		days,
		months,
		daysOfWeek;

	// Validite number of configuration entries
	if (parts.length !== 6) {
		raise('invalid configuration format ("' + pattern + '"), exacly five space separated parts required.');
	}

	// Validate field content
	for (i = 0; i < parts.length; i++) {
		part = parts[i].trim();

		// Check that part only contain legal characters ^[0-9-,]+$
		if (part !== '*' && reValidCron.test(part)) {
			raise('configuration entry ' + (i + 1) + ' (' + part + ') contains illegal characters.');
		}
	}

	// Check that we dont have both months and daysofweek
	hasMonths = (parts[4] !== '*');
	hasDaysOfWeek = (parts[5] !== '*');
	hasDates = (parts[3] !== '*');

	// Month/Date and dayofweek is incompatible
	if (hasDaysOfWeek && (hasMonths || hasDates)) {
		raise('configuration invalid, you can not combine month/date with day of week.');
	}
 
	// Parse parts into arrays, validates as we go
	partToArray('seconds',               target.seconds,	parts[0], 0);
	partToArray('minutes',               target.minutes,	parts[1], 0);
	partToArray('hours',                 target.hours,		parts[2], 0);
	partToArray('days',                  target.days,		parts[3], -1);
	partToArray('months',                target.months,		parts[4], -1);
	partToArray('daysOfWeek',            target.daysOfWeek,	parts[5], 0);
 
	// 0 = Sunday, 7 = Sunday
	if (target.daysOfWeek[0]) {
		target.daysOfWeek[7] = 1;
	}

	if (target.daysOfWeek[7]) {
		target.daysOfWeek[0] = 1;
	}
}
 
function Cron (pattern) {
	var self = this;

	self.pattern = pattern;

	self.seconds 		= Array(60).fill(0); // 0-59
	self.minutes 		= Array(60).fill(0); // 0-59
	self.hours          = Array(24).fill(0); // 0-23
	self.days           = Array(31).fill(0); // 0-30 in array, 1-31 in config
	self.months         = Array(12).fill(0); // 0-11 in array, 1-12 in config
	self.daysOfWeek     = Array(8).fill(0);  // 0-7 Where 0 = Sunday and 7=Sunday;

	self.schedulerDefaults = {
		stopAt: 	Infinity,
		maxRuns: 	Infinity,
		kill: 		false
	};

	parsePattern(pattern, self);

	return this;
}
 
Cron.prototype.next = function (date) {

	var self = this,
		date = date || new Date(),
		temp,

		collection = {
			cSecs: date.getSeconds() + 1,
			cMins: date.getMinutes(),
			cHour: date.getHours(),
			cDate: date.getDate(),
			cMon: date.getMonth(),
			cYear: date.getFullYear(),
		},

		secs = self.seconds,
		mins = self.minutes,
		hours = self.hours,
		days = self.days,
		months = self.months,

		hasDays = !(days.filter(Boolean).length==31),
		hasMonths = !(months.filter(Boolean).length==12);
 
	function goUp (what, who, current, increment, valueIndexOffset) {

		var i, found = false, dayChanged;

		if (what[who[current] + valueIndexOffset]) return true;

		for (i = (who[current] + valueIndexOffset); i < mins.length; i++) {
			if (what[i]) {
				who[current] = i-valueIndexOffset;
				found = true;
				break;
			}
		}

		if (!found) {
			who[increment] += 1;

			for (i = 0; i < who[current] + valueIndexOffset; i++) {
				if (what[i]) {
					who[current] = i - valueIndexOffset;
					break;
				}
			}
		}

		return found;
	}
 
	// Count up to minute and hour
 	var upMinHour = function (collection) {
 		goUp(secs,  collection, 'cSecs','cMins', 0);
		goUp(mins,  collection, 'cMins','cHour', 0);
		goUp(hours, collection, 'cHour','cDate', 0);
 	}; 
 	upMinHour(collection);
	
	dayChanged = false;

	if (hasDays || hasMonths) {
		// Count up to date and month
		dayChanged = goUp(days, collection, 'cDate', 'cMon', -1);
		goUp(months, collection, 'cMon', 'cYear', 0); // No need to compensate here as javascript count months 0-11

		return new Date(collection.cYear, collection.cMon, collection.cDate, collection.cHour, collection.cMins, collection.cSecs, 0);
	}

	while (!self.daysOfWeek[new Date(collection.cYear, collection.cMon, collection.cDate, collection.cHour, collection.cMins, collection.cSecs, 0).getDay()]) {
		collection.cDate += 1;
		dayChanged = true;
	}

	// If day changed, we need to re-run hours and minutes
	if (dayChanged) {
		collection.cMin = collection.cHour = 0;
		upMinHour(collection);
	}

	return new Date(collection.cYear, collection.cMon, collection.cDate, collection.cHour, collection.cMins, collection.cSecs, 0);
}

Cron.prototype.msToNext = function (prev) {
	return (this.next(prev) - new Date().getTime());
}

Cron.prototype.schedule = function (opts, f, recurse) {
	
	var self = this,
		waitMs;
		
	// Make opts optional
	if ( f === undefined ) {
		f = opts;
		opts = {};
	}

	opts.previous = (recurse === false) ? new Date() : opts.startAt || opts.previous;
	opts.stopAt = opts.stopAt || this.schedulerDefaults.stopAt;
	opts.kill = opts.kill || this.schedulerDefaults.kill;
	opts.rest = opts.rest || 0;
	if ( opts.maxRuns === undefined ) opts.maxRuns = this.schedulerDefaults.maxRuns;

	// One-timer
	opts.startAt = undefined;

	// Get ms to next run
	waitMs = this.msToNext(opts.previous);

	// Check for stop conditions
	if ( opts.maxRuns <= 0 ) return;
	if ( opts.stopAt !== Infinity && opts.previous.getTime() + waitMs/1000 > opts.stopAt.getTime() ) return;
	if ( opts.kill ) return;

	// setTimeout cant handle more than Math.pow(2, 32 - 1) - 1 ms
	if ( waitMs > 0x7FFFFFFF) {
		waitMs = 0x7FFFFFFF;
	}

	// All ok, go go!
	setTimeout( function() {

		// Are we running? If waitMs is maxed out, this is a blank run
		if ( waitMs !== 0x7FFFFFFF ) {
			opts.maxRuns--;
			opts.previous = new Date();
			f();
		}

		// Recurse
		self.schedule(opts, f, true);

	}, waitMs );

	// First run? Return killer
	if ( !recurse ) {
		return {
			kill: function() {
				opts.kill = true;
			}
		}
	}

}

// Expose to 
// ... Node
if (typeof module != 'undefined' && typeof module.exports === 'object') {
	module.exports = function (pattern) { return new Cron(pattern); };

// ... AMD
} else if (typeof define === 'function' && define.amd) {
	define([], function () {
		return function (pattern) { return new Cron(pattern); };
	});

// ... Other browser implementations
} else {
	this.cron = function (pattern) { return new Cron(pattern); };
}

// Debug shit - To be removed
if(true) {

	var scheduler = new Cron('* * * * * *');

	// Start an infinite job that runs every second
	var job0 = scheduler.schedule(function() {
		console.log('I\'m invincible!!');
	});

	// Start a job that runs from 5 seconds from now, to 10 seconds from now
	var job1 = scheduler.schedule({
		startAt: new Date(new Date().getTime()+5000),
		stopAt: new Date(new Date().getTime()+10000),
	},function() {
		console.log('5-10s');
	});

	// Start a job that runs from 7 seconds from now, to 15 seconds from now
	var job2 = scheduler.schedule({
		startAt: new Date(new Date().getTime()+7000),
		stopAt: new Date(new Date().getTime()+15000),
	},function() {
		console.log('7-15s...?');
	});

	// Kill the infinite job after 20 seconds, HEH!
	setTimeout( function () { job0.kill(); }, 20000);

	// Start a job that run five times
	scheduler.schedule({maxRuns: 5}, function () {
		console.log('This will run five times');
	});

}