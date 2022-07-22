(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Owl Carousel v2.3.4
 * Copyright 2013-2018 David Deutsch
 * Licensed under: SEE LICENSE IN https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE
 */
/**
 * Owl carousel
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from being retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,
		checkVisibility: true,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',
		slideTransition: '',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat > 0) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
				repeat -= 1;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			this.$stage.children('.center').removeClass('center');
			if (this.settings.center) {
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Create the stage DOM element
	 */
	Owl.prototype.initializeStage = function() {
		this.$stage = this.$element.find('.' + this.settings.stageClass);

		// if the stage is already in the DOM, grab it and skip stage initialization
		if (this.$stage.length) {
			return;
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + '>', {
			"class": this.settings.stageClass
		}).wrap( $( '<div/>', {
			"class": this.settings.stageOuterClass
		}));

		// append stage
		this.$element.append(this.$stage.parent());
	};

	/**
	 * Create item DOM elements
	 */
	Owl.prototype.initializeItems = function() {
		var $items = this.$element.find('.owl-item');

		// if the items are already in the DOM, grab them and skip item initialization
		if ($items.length) {
			this._items = $items.get().map(function(item) {
				return $(item);
			});

			this._mergers = this._items.map(function() {
				return 1;
			});

			this.refresh();

			return;
		}

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.isVisible()) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);
	};

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.initializeStage();
		this.initializeItems();

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * @returns {Boolean} visibility of $element
	 *                    if you know the carousel will always be visible you can set `checkVisibility` to `false` to
	 *                    prevent the expensive browser layout forced reflow the $element.is(':visible') does
	 */
	Owl.prototype.isVisible = function() {
		return this.settings.checkVisibility
			? this.$element.is(':visible')
			: true;
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.isVisible()) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] !== undefined ? coordinates[index + 1] : value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's' + (
					this.settings.slideTransition ? ' ' + this.settings.slideTransition : ''
				)
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			if (iterator) {
				reciprocalItemsWidth = this._items[--iterator].width();
				elementWidth = this.$element.width();
				while (iterator--) {
					reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
					if (reciprocalItemsWidth > elementWidth) {
						break;
					}
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.isVisible()) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();
		this.$stage.remove();
		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.isVisible();
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.isVisible() === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);
					//TODO: Need documentation for this new option
					if (settings.lazyLoadEager > 0) {
						n += settings.lazyLoadEager;
						// If the carousel is looping also preload images that are to the "left"
						if (settings.loop) {
              position -= settings.lazyLoadEager;
              n++;
            }
					}

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false,
		lazyLoadEager: 0
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
                url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src') || $element.attr('data-srcset');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
            } else if ($element.is('source')) {
                $element.one('load.owl.lazy', $.proxy(function() {
                    this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
                }, this)).attr('srcset', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		this._previousHeight = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name === 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
		this._intervalId = null;
		var refThis = this;

		// These changes have been taken from a PR by gavrochelegnou proposed in #1575
		// and have been made compatible with the latest jQuery version
		$(window).on('load', function() {
			if (refThis._core.settings.autoHeight) {
				refThis.update();
			}
		});

		// Autoresize the height of the carousel when window is resized
		// When carousel has images, the height is dependent on the width
		// and should also change on resize
		$(window).resize(function() {
			if (refThis._core.settings.autoHeight) {
				if (refThis._intervalId != null) {
					clearTimeout(refThis._intervalId);
				}

				refThis._intervalId = setTimeout(function() {
					refThis.update();
				}, 250);
			}
		});

	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			lazyLoadEnabled = this._core.settings.lazyLoad,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		if (maxheight <= 1 && lazyLoadEnabled && this._previousHeight) {
			maxheight = this._previousHeight;
		}

		this._previousHeight = maxheight;

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] !== 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com|be\-nocookie\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'width:' + video.width + 'px;height:' + video.height + 'px;' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = $('<div/>',{
						"class": 'owl-video-tn ' + lazyClass,
						"srcType": path
					});
				} else {
					tnLink = $( '<div/>', {
						"class": "owl-video-tn",
						"style": 'opacity:1;background-image:url(' + path + ')'
					});
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap( $( '<div/>', {
			"class": "owl-video-wrapper",
			"style": dimensions
		}));

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html,
			iframe;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		html = $( '<iframe frameborder="0" allowfullscreen mozallowfullscreen webkitAllowFullScreen ></iframe>' );
		html.attr( 'height', height );
		html.attr( 'width', width );
		if (video.type === 'youtube') {
			html.attr( 'src', '//www.youtube.com/embed/' + video.id + '?autoplay=1&rel=0&v=' + video.id );
		} else if (video.type === 'vimeo') {
			html.attr( 'src', '//player.vimeo.com/video/' + video.id + '?autoplay=1' );
		} else if (video.type === 'vzaar') {
			html.attr( 'src', '//view.vzaar.com/' + video.id + '/player?autoplay=true' );
		}

		iframe = $(html).wrap( '<div class="owl-video-frame" />' ).insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @author Tom De Caluwé
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout id.
		 * @type {Number}
		 */
		this._call = null;

		/**
		 * Depending on the state of the plugin, this variable contains either
		 * the start time of the timer or the current timer value if it's
		 * paused. Since we start in a paused state we initialize the timer
		 * value.
		 * @type {Number}
		 */
		this._time = 0;

		/**
		 * Stores the timeout currently used.
		 * @type {Number}
		 */
		this._timeout = 0;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = true;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position' && this._paused) {
					// Reset the timer. This code is triggered when the position
					// of the carousel was changed through user interaction.
					this._time = 0;
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Transition to the next slide and set a timeout for the next transition.
	 * @private
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype._next = function(speed) {
		this._call = window.setTimeout(
			$.proxy(this._next, this, speed),
			this._timeout * (Math.round(this.read() / this._timeout) + 1) - this.read()
		);

		if (this._core.is('interacting') || document.hidden) {
			return;
		}
		this._core.next(speed || this._core.settings.autoplaySpeed);
	}

	/**
	 * Reads the current timer value when the timer is playing.
	 * @public
	 */
	Autoplay.prototype.read = function() {
		return new Date().getTime() - this._time;
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		var elapsed;

		if (!this._core.is('rotating')) {
			this._core.enter('rotating');
		}

		timeout = timeout || this._core.settings.autoplayTimeout;

		// Calculate the elapsed time since the last transition. If the carousel
		// wasn't playing this calculation will yield zero.
		elapsed = Math.min(this._time % (this._timeout || timeout), timeout);

		if (this._paused) {
			// Start the clock.
			this._time = this.read();
			this._paused = false;
		} else {
			// Clear the active timeout to allow replacement.
			window.clearTimeout(this._call);
		}

		// Adjust the origin of the timer to match the new timeout value.
		this._time += this.read() % timeout - elapsed;

		this._timeout = timeout;
		this._call = window.setTimeout($.proxy(this._next, this, speed), timeout - elapsed);
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (this._core.is('rotating')) {
			// Reset the clock.
			this._time = 0;
			this._paused = true;

			window.clearTimeout(this._call);
			this._core.leave('rotating');
		}
	};

	/**
	 * Pauses the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (this._core.is('rotating') && !this._paused) {
			// Pause the clock.
			this._time = this.read();
			this._paused = true;

			window.clearTimeout(this._call);
		}
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [
			'<span aria-label="' + 'Previous' + '">&#x2039;</span>',
			'<span aria-label="' + 'Next' + '">&#x203a;</span>'
		],
		navSpeed: false,
		navElement: 'button type="button" role="presentation"',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [
			'owl-prev',
			'owl-next'
		],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<button role="button">')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'button', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		/*$el.on('focusin', function() {
			$(document).off(".carousel");

			$(document).on('keydown.carousel', function(e) {
				if(e.keyCode == 37) {
					$el.trigger('prev.owl')
				}
				if(e.keyCode == 39) {
					$el.trigger('next.owl')
				}
			});
		});*/

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override, settings;
		settings = this._core.settings;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			if (control === '$relative' && settings.navContainer) {
				this._controls[control].html('');
			} else {
				this._controls[control].remove();
			}
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.3.4
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);

},{}],2:[function(require,module,exports){
(function($) {

    $(document).ready(function() {
        $(window).load(function() {
            // $('body').on('click touch', '.services-slider .slider-item', function(){
            //     console.log('click');
            //     $(this).find('.link-block').click();
            // });
            // $('body').on('click touch', '.services-slider .slider-item', function(){
            //     console.log('click');
            //     $(this).find('.link-block').click();
            // });
        });

        $.fn.isValid = function(){
            return this[0].checkValidity()
        }
        
        $('.form_sender').on('click touch', function(){
            $(this).parent().submit();
        });

        $('.file_uploader').on('click touch', function(){
            $(this).parent().find('input[name="file"]')[0].click();
        });

        // Прелоадер
        // $('body a').on('click', function(){
        //     hrefNow = $(this).attr('href');
        //     targetNow = $(this).attr('target');
        //     relNow = $(this).attr('rel');
        //     if($(this).parent().hasClass('slider-item')){} else {
        //         if($(this).parent().parent().hasClass('menu-general')){} else {
        //             if($(this).hasClass('has_children_link')){} else {
        //                 if($(this).hasClass('open-popup-video')){} else {
        //                     if(relNow){} else {
        //                         if(hrefNow){
        //                             if(hrefNow == '#'){}else {
        //                                 if(hrefNow == 'javascript:void(0)'){}else {
        //                                     if (hrefNow.indexOf("#") >= 0){}else {
        //                                         console.log(hrefNow);
        //                                         if(targetNow == '_blank'){
        //                                             window.open(hrefNow);
        //                                         }
        //                                         else {
        //                                             if($('.preloader_bg').length){
        //                                                 $('.preloader_bg').addClass('active');
        //                                             }
        //                                             setTimeout(function(){
        //                                                 document.location.href = hrefNow;
        //                                             }, 300);
        //                                         }
        //                                         return false;
        //                                     }
        //                                 }
        //                             }
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // });

        $('.ajax-form').submit(function (evtObj) {
            evtObj.preventDefault();
            if ($(this).isValid()) {
                if($(this).find('input[name="file"]').length){
                    if ($(this).find('input[name="file"]').val() !== '') {
                        var form = document.forms.feedback;
                        var formData = new FormData(form);
                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", "/mails_sender.php");
                        xhr.onreadystatechange = function () {
                            if (xhr.readyState == 4) {
                                if (xhr.status == 200) {
                                    data = xhr.responseText;
                                    if (data === 'Отправлено письмо с вложениями.') {
                                        $('input[name="fio"]').val('');
                                        $('input[name="company"]').val('');
                                        $('input[name="phone"]').val('');
                                        $('input[name="mail"]').val('');
                                        $('input[name="file"]').val('');
                                        var pathname = window.location.pathname;
                                        if(pathname.indexOf('/en/') > -1){
                                            $('.content__section-feedback__input').text('Upload resume');
                                        }
                                        else {
                                            $('.content__section-feedback__input').text('Загрузить резюме');
                                        }
                                        alertify.success('Успешная отправка');
                                    }
                                    else {
                                        $('input[name="fio"]').val('');
                                        $('input[name="company"]').val('');
                                        $('input[name="phone"]').val('');
                                        $('input[name="mail"]').val('');
                                        $('input[name="file"]').val('');
                                        var pathname = window.location.pathname;
                                        if(pathname.indexOf('/en/') > -1){
                                            $('.content__section-feedback__input').text('Upload resume');
                                        }
                                        else {
                                            $('.content__section-feedback__input').text('Загрузить резюме');
                                        }
                                        alertify.success('Успешная отправка');
                                    }
                                }
                            }
                        };
                        xhr.send(formData);
                    } else {
                        var form = $(this);
                        $.ajax({
                            url: '/mails_sender.php',
                            type: 'POST',
                            data: form.serialize(),
                            success: function (data) {
                                if (data === 'Отправлено письмо без вложений.') {
                                    $('input[name="fio"]').val('');
                                    $('input[name="company"]').val('');
                                    $('input[name="phone"]').val('');
                                    $('input[name="mail"]').val('');
                                    $('input[name="file"]').val('');
                                    var pathname = window.location.pathname;
                                    if(pathname.indexOf('/en/') > -1){
                                        $('.content__section-feedback__input').text('Upload resume');
                                    }
                                    else {
                                        $('.content__section-feedback__input').text('Загрузить резюме');
                                    }
                                    alertify.success('Успешная отправка');
                                } else {
                                    $('input[name="fio"]').val('');
                                    $('input[name="company"]').val('');
                                    $('input[name="phone"]').val('');
                                    $('input[name="mail"]').val('');
                                    $('input[name="file"]').val('');
                                    var pathname = window.location.pathname;
                                    if(pathname.indexOf('/en/') > -1){
                                        $('.content__section-feedback__input').text('Upload resume');
                                    }
                                    else {
                                        $('.content__section-feedback__input').text('Загрузить резюме');
                                    }
                                    alertify.success('Успешная отправка');
                                }
                            },
                            error: function (data) {
                                alertify.error('Ошибка: '+data);
                            }
                        });
                    }
                }
            }
            else {
                alertify.error('Заполните необходимые поля');
            }
        });

        // if($('.content__section-contacts__offices-item__slider').length){
        //     $('.content__section-contacts__offices-item__slider').addClass('hidded_slider')
        // }

        $('.content__section-solutionsfull__splash').on('click touch', function(){
            if($('.content__section-solutionsfull__splash a').length){
                $(this).find('a')[0].click();
            }
        });

        $('.content__section-about__video').on('click touch', function(){
            $(this).find('.open-popup-video').click();
        });

        $('.content__section-projectsfull__banner-block').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-200
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
        });

        $('.content__section-header__menu-item--dashed').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-200
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
        });

        $('.content__section-projects .content__section-projects__widget-block').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-50
                });
            }
        });

        $('.content__section-projects__header-block__btn').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-50
                });
            }
        });

        $('.page-template-about-php .home-projects-top .data--box').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".missions_container").offset().top-200
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".missions_container").offset().top-100
                });
            }
        });

        $('.page-template-vacancy .data--box').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-200
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
        });

        $('.content__section-press .data--box').on('click touch', function(){
            if($(window).width() > 1200){
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-100
                });
            }
            else {
                $('html,body').animate({
                    scrollTop: $(".scroll_point").offset().top-50
                });
            }
        });


        if($('.content__section-team').length){
            if($('.content__section-career').length){
                $('.content__section-about__btn').on('click touch', function(){
                    if($(window).width() > 1200){
                        $('html,body').animate({
                            scrollTop: $(".scroll_point").offset().top-100
                        });
                    }
                    else {
                        $('html,body').animate({
                            scrollTop: $(".scroll_point").offset().top-50
                        });
                    }
                });
                $('.team-data--box').on('click touch', function(){
                    if($(this).parent().parent().parent().parent().hasClass('content__section-about__header-item')){} else {
                        if($(window).width() > 1200){
                            $('html,body').animate({
                                scrollTop: $(".scroll_point").offset().top-100
                            });
                        }
                        else {
                            $('html,body').animate({
                                scrollTop: $(".scroll_point").offset().top-50
                            });
                        }
                    }
                });
            }
            else {
                $('.content__section-team .content__section-about__btn').on('click touch', function(){
                    if($(window).width() > 1200){
                        $('html,body').animate({
                            scrollTop: $(".content__section-about__video").offset().top-100
                        });
                    }
                    else {
                        $('html,body').animate({
                            scrollTop: $(".content__section-about__video").offset().top-50
                        });
                    }
                });
            }
        }

        $('.modal__solutions-top').on('click touch', function(){
            if($(window).width() > 1200){
                $(".modal__solutions").animate({
                    scrollTop: 0
                },200);
            }
            else {
                $(".jquery-modal.current").animate({
                    scrollTop: 0
                },200);
            }
        });

        $('.attachmentsFeedback').on('change', function(){
            fileName = $(this).val().replace(/.*(\/|\\)/, '');
            if(fileName.length > 0) {
                if (fileName.length > 15) {
                    fileName = fileName.substring(0, 15) + " ...";
                }
                $(this).parent().find('button').text(fileName);
            }
        });
        
        $(".phoneRuMask").inputmask("+7 (999) 999-99-99", {
            "placeholder": "",
            clearMaskOnLostFocus: true,
            definitions: {
                "A": {
                    validator: "[a-zA-Z0-9]",
                    casing: "upper"
                }
            },
        });
        
        // Временно
        $(".footer-group li.menu-item").each(function( index ) {
            linkNow = $(this).find('a');
            if(linkNow.text() == 'E-commerce'){
                linkNow.attr('rel', 'modal:open');
                linkNow.attr('href', '#ecommerce');
            }
            else if(linkNow.text() == 'Управление предприятием'){
                linkNow.attr('rel', 'modal:open');
                linkNow.attr('href', '#enterprisemanagement');
            }
            else if(linkNow.text() == 'Управление процессами розничной торговли'){
                linkNow.attr('rel', 'modal:open');
                linkNow.attr('href', '#retailprocessmanagement');
            }
            else if(linkNow.text() == 'Retail Process Management'){
                linkNow.attr('rel', 'modal:open');
                linkNow.attr('href', '#retailprocessmanagement');
            }
            else if(linkNow.text() == 'Enterprise Management'){
                linkNow.attr('rel', 'modal:open');
                linkNow.attr('href', '#enterprisemanagement');
            }
        });
        // Временно

        $(".content__section-projectsfull__accordion-item").each(function( index ) {
            if($(this).has( ".content__section-projectsfull__accordion-item__content" ).length){}else{
                $(this).addClass('clearTab');
            }
        });

        $('.content__section-projectsfull__accordion-item').on('click touch', function(){
            if(!$(this).hasClass('content__section-solutionsfull__parent')){
                if($(this).hasClass('active')){
                    $(this).removeClass('active');
                }
                else {
                    $(this).addClass('active');
                }
            }
        });

        /**
         * Footer nav (mobile version)
         */
        $('.footer-sidebars-area').on('click', '.widget-title', function(e) {
            if( $(window).outerWidth() < 992 ) {
                e.preventDefault();
                $(this).parent().find('nav').slideToggle('250');
                $(this).toggleClass('open');
            }
        });

        /**
         * Convert SVG image to SVG code
         */
        if($('.img-svg').length){
            convertImagesToSVG('.img-svg');
        }

        /**
         * Open popup with video
         */
        $('.open-popup-video').fancybox({
            baseClass: 'video-popup',
            youtube : {
                controls : 1,
                showinfo : 1,
                autoplay: 1,
            },
            'autoScale': true,
            'transitionIn': 'elastic',
            'transitionOut': 'elastic',
            'speedIn': 500,
            'speedOut': 300,
            'autoDimensions': true,
            'centerOnScroll': true,
            video: {
                tpl:
                  '<video class="fancybox-video" playsinline autoplay controls controlsList="nodownload" poster="{{poster}}">' +
                  '<source src="{{src}}" type="{{format}}" />' +
                  'Sorry, your browser doesn\'t support embedded videos, <a href="{{src}}">download</a> and watch with your favorite video player!' +
                  "</video>",
                format: "", // custom video format
                autoStart: true
            },
            'showNavArrows'	: false,
            'href' : $(this).attr('href')
        });

        /**
         * Open popup with team
         */
        if( $('.people-slider--item').length ) {
            $('.people').on('click', '.people-slider--item', function(e) {
                const indexItem = $('.people .owl-item').index( $(this).parent() );
                $.fancybox.open($('.people-slider--item .popup-data .popup-data--content'), {
                    type: 'inline',
                    baseClass: 'team-popup-slider',
                    infobar: false,
                    smallBtn: false,
                    buttons: [
                        "close"
                    ],
                    btnTpl: {
                        // Arrows
                        arrowLeft:
                            '<button data-fancybox-prev class="fancybox-button fancybox-button--arrow_left" title="{{PREV}}">' +
                            '<div class="svg-icon"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="14.5" stroke="#496188"/><path fill-rule="evenodd" clip-rule="evenodd" d="M10.6862 17.1769C10.477 16.9972 10.1597 17.0194 9.97745 17.2264C9.79525 17.4335 9.81717 17.747 10.0264 17.9267L12.2586 19.8784C12.4678 20.0581 12.7852 20.0359 12.9674 19.8288C13.1496 19.6218 13.1276 19.3083 12.9184 19.1286L10.6862 17.1769ZM8.86376 15.254C8.8633 15.0705 8.95837 14.9096 9.10213 14.818L12.6709 11.2495C12.8724 11.0481 13.2046 11.0536 13.4129 11.2619C13.6212 11.4703 13.6268 11.8024 13.4253 12.0039L10.6917 14.7373L20.4234 14.7341C20.7093 14.7348 20.9416 14.9671 20.9423 15.253C20.943 15.5389 20.7118 15.7701 20.426 15.7694L9.38271 15.773C9.2496 15.7726 9.1281 15.7221 9.03618 15.6393L9.03517 15.6393L9.02568 15.6296C8.92628 15.5351 8.86413 15.4017 8.86376 15.254Z" fill="#496188"/></svg></div>' +
                            "</button>",
                        arrowRight:
                            '<button data-fancybox-next class="fancybox-button fancybox-button--arrow_right" title="{{NEXT}}">' +
                            '<div class="svg-icon"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="14.5" stroke="#496188"/><path fill-rule="evenodd" clip-rule="evenodd" d="M18.47 12.9794C18.6793 13.1591 18.9966 13.1369 19.1788 12.9298C19.361 12.7227 19.3391 12.4092 19.1299 12.2295L16.8977 10.2779C16.6884 10.0982 16.3711 10.1204 16.1889 10.3274C16.0067 10.5345 16.0286 10.848 16.2379 11.0277L18.47 12.9794ZM20.2925 14.9022C20.293 15.0857 20.1979 15.2466 20.0542 15.3382L16.4854 18.9067C16.2839 19.1082 15.9517 19.1026 15.7434 18.8943C15.5351 18.686 15.5295 18.3538 15.731 18.1523L18.4645 15.419L8.73292 15.4222C8.44703 15.4215 8.21469 15.1892 8.21397 14.9033C8.21325 14.6174 8.44443 14.3862 8.73032 14.3869L19.7736 14.3832C19.9067 14.3836 20.0282 14.4341 20.1201 14.5169L20.1211 14.5169L20.1306 14.5266C20.23 14.6212 20.2922 14.7545 20.2925 14.9022Z" fill="#496188"/></svg></div>' +
                            "</button>",
                    }
                },
                    indexItem
                );
            });
        }

        /**
         * Open General menu
         */
        $('.header-group .header-group-block').on('click', '.burger', function(e) {
            e.preventDefault();
			$('html').addClass('freezePage'); 
			$('body').addClass('freezePage');
            $('.general_menu').addClass('open');
            setTimeout(function() {
                $('.general_menu').addClass('animation');
            }, 800);
            $('html, body').css('overflow', 'hidden');
        });

        /**
         * Close General menu
         */

        $('.general_menu').on('click', '.general_menu-close', function(e) {
            e.preventDefault();
            const $item = $(this);
            $item.closest('.general_menu').removeClass('animation');
            setTimeout(function() {
                $item.closest('.general_menu').removeClass('open');
                $('html').removeClass('freezePage'); 
				$('body').removeClass('freezePage');
            }, 1000);
            $('html, body').removeAttr('style');
            $item.closest('.general_menu').find('.sub-menu').removeClass('open').hide();
            $item.closest('.general_menu').find('.has-child').removeClass('active');
            $item.closest('.general_menu').find('ul').removeClass('open-submenu');
            $item.closest('.general_menu').find('.line').removeClass('active');
            $item.closest('.general_menu').find('.bg-block').removeClass('active-first active-second');
            if( $(window).width() < 1200 ) {
                $item.closest('.general_menu').find('.nav-back').removeClass('active');
            }
        });

        $('.general_menu').on('click', '.general_menu-overlay', function(e) {
            e.preventDefault();
            const $item = $(this);
            $item.closest('.general_menu').removeClass('animation');
            setTimeout(function() {
                $item.closest('.general_menu').removeClass('open');
                $('html').removeClass('freezePage'); 
				$('body').removeClass('freezePage');
            }, 1000);
            $('html, body').removeAttr('style');
            $item.closest('.general_menu').find('.sub-menu').removeClass('open').hide();
            $item.closest('.general_menu').find('.has-child').removeClass('active');
            $item.closest('.general_menu').find('ul').removeClass('open-submenu');
            $item.closest('.general_menu').find('.line').removeClass('active');
            $item.closest('.general_menu').find('.bg-block').removeClass('active-first active-second');
            if( $(window).width() < 1200 ) {
                $item.closest('.general_menu').find('.nav-back').removeClass('active');
            }
        });


        /**
         * General sub menu
         */
        $('.has-child > a').click(function(e) {
            e.preventDefault();
            const generalParent = $(this).closest('ul');
            const parentItem = $(this).closest('li');

            if( ! parentItem.hasClass('active') ) {
                parentItem.closest('ul').find('.has-child').removeClass('active');
                parentItem.addClass('active');
                parentItem.closest('ul').find('.sub-menu').removeClass('open').hide();
                if( $(window).width() < 1200 ) {
                    $(this).next('.sub-menu').addClass('open').show();
                    if( ! generalParent.hasClass('open-submenu') ) {
                        generalParent.addClass('open-submenu');
                    }
                } else {
                    $(this).next('.sub-menu').addClass('open').show();
                }
            } else {
                parentItem.removeClass('active');
                if( $(window).width() < 1200 ) {
                    $(this).next('.sub-menu').removeClass('open').hide();
                } else {
                    $(this).next('.sub-menu').removeClass('open').hide();
                }
            }

            /**
             * Show/Hide vertical lines and bg data
             */
            if( $('.general_menu .menu-depth-1.open').length ) {
                if( ! $('.general_menu .line-first').hasClass('active') ) {
                    $('.general_menu .line-first').addClass('active');
                }

                if( ! $('.general_menu .bg-block').hasClass('active-first') ) {
                    $('.general_menu .bg-block').addClass('active-first');
                }
            } else {
                $('.general_menu .line-first').removeClass('active');
                $('.general_menu .bg-block').removeClass('active-first');
            }

            if( $('.general_menu .menu-depth-2.open').length ) {
                if( ! $('.general_menu .line-second').hasClass('active') ) {
                    $('.general_menu .line-second').addClass('active');
                }

                if( ! $('.general_menu .bg-block').hasClass('active-second') ) {
                    $('.general_menu .bg-block').addClass('active-second');
                }
            } else {
                $('.general_menu .line-second').removeClass('active');
                $('.general_menu .bg-block').removeClass('active-second');
            }

            if( ! parentItem.hasClass('active') && generalParent.hasClass('general_menu-list') ) {
                $('.general_menu .bg-block').removeClass('active-first active-second');
                $('.general_menu .line').removeClass('active');
            }

            if( $(window).width() < 1200 ) {
                if( $('.general_menu .menu-depth-1.open').length || $('.general_menu .menu-depth-2.open').length ) {
                    if( ! $('.general_menu .nav-back').hasClass('active') ) {
                        $('.general_menu .nav-back').addClass('active');
                    }

                    $('.general_menu-block .toggle-search').hide();
                } else {
                    if( $('.general_menu .nav-back').hasClass('active') ) {
                        $('.general_menu .nav-back').removeClass('active');
                    }
                }
            }
        });

        /**
         * Return nav back
         */
        $('.general_menu').on('click', '.nav-back', function(){
            if( $('.general_menu .menu-depth-2.open').length ) {
                $('.general_menu .menu-depth-2').removeClass('open').hide();
                $('.general_menu .menu-depth-1').removeClass('open-submenu');
                $('.general_menu .menu-depth-2').closest('li').removeClass('active');
            } else if( $('.general_menu .menu-depth-1.open').length ) {
                $('.general_menu .menu-depth-1').removeClass('open').hide();
                $('.general_menu-list').removeClass('open-submenu');
                $('.general_menu .menu-depth-1').closest('li').removeClass('active');
            }

            if( $('.general_menu .menu-depth-1.open').length < 1 && $('.general_menu .menu-depth-2.open').length < 1 ) {
                $(this).removeClass('active');
                $('.general_menu .bg-block').removeClass('active-first active-second');
                $('.general_menu-block .toggle-search').show();
            }
        });

        /**
         * Go to anchor
         */
        $('.go-to-anchor').click(function(e){
            e.preventDefault();
            const anchor = $(this).attr('href');
            if( anchor.length < 1 ) {
                return false;
            }
            const scrollOffset = $( anchor ).offset().top - $('header').outerHeight( true ) - 30;

            $('html, body').animate({
                scrollTop: scrollOffset
            }, 800);
        });

        if($(window).width() < 1200){
            $('.content__section-contacts__offices-item__title').on('click touch', function(){
                if($(this).parent().hasClass('active')){
                    $(this).parent().removeClass('active');
                }
                else {
                    $(this).parent().addClass('active');
                }
            });
        }

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const getmode = urlParams.get('mode')
        
        if($(window).width() > 1200){
            $('.content__section-contacts__offices-item[data-item="1"]').addClass('red');
            if(getmode && getmode.length > 0){
                $('.content__section-contacts__offices-item[data-item="1"]').removeClass('red');
                if(getmode == 'work'){
                    $('.content__section-contacts__offices-item[data-item="1"]').addClass('red');
                }
                else if(getmode == 'career'){
                    $('.content__section-contacts__offices-item[data-item="2"]').addClass('red');
                }
            }
            itemNow = $('.content__section-contacts__offices .content__section-contacts__offices-item');
            itemNow.on('click touch', function(){
                dataItem = $(this).data('item');
                $('.content__section-contacts__offices-item').removeClass('red');
                $('.content__section-contacts__offices-item').removeClass('active');
                if(!$(this).hasClass('red')){
                    $(this).addClass('red');
                }
                $('.content__section-contacts__col--right .content__section-contacts__offices-item[data-item="'+dataItem+'"]').addClass('active');
            });
        }

        /**
         * Sliders
         */

        // if($(window).width() < 768) {
        //     if( $('.tops_slider').length ) {
        //         $('.tops_slider').owlCarousel({
        //             onTranslate: translateSlider,
        //             onInitialize: initSliderN,
        //             center: false,
        //             items: 1,
        //             loop: false,
        //             margin: 30,
        //             lazyLoad: true,
        //             autoWidth: true,
        //             dots: true,
        //             nav: false,
        //         });
        //     }
        // }

        if( $('.content__section-contacts__offices-item__slider').length ) {
            $('.content__section-contacts__offices-item__slider').owlCarousel({
                onTranslate: translateSlider,
                onInitialize: initSliderN,
                center: false,
                items: 1,
                loop: false,
                margin: 0,
                lazyLoad: true,
                autoWidth: false,
                dots: true,
                nav: false,
                responsive: {
                    1200: {
                        nav: true,
                        dots: false,
                        navText: [
                            '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
                            '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
                        ],
                    },
                }
            });
        }

        if($('.content__section-contacts__offices').length){
            if($(window).width() < 1201){
                $('.content__section-contacts__offices').find('.content__section-contacts__offices-item:first-child').addClass('active');
                if(getmode && getmode.length > 0){
                    $('.content__section-contacts__offices').find('.content__section-contacts__offices-item:first-child').removeClass('active');
                    if(getmode == 'work'){
                        $('.content__section-contacts__offices').find('.content__section-contacts__offices-item:first-child').addClass('active');
                    }
                    else if(getmode == 'career'){
                        $('.content__section-contacts__offices').find('.content__section-contacts__offices-item:last-child').addClass('active');
                    }
                }
            }
        }

        if( $('.people-slider').length ) {
            $('.people-slider').owlCarousel({
                onTranslate: translateSlider,
                center: false,
                items: 1,
                loop: false,
                margin: 20,
                dots: true,
                responsive: {
                    993: {
                        items: 4,
                        center: false,
                        margin: 0,
                    },
                    501: {
                        items: 2,
                        center: false,
                        margin: 20,
                        dots: true,
                    }
                }
            });
        }

        if( $('.brands-slider').length ) {
            $('.brands-slider').owlCarousel({
                center: true,
                items: 2,
                loop: true,
                margin: 12,
                dots: false,
                autoplay: true,
                autoplaySpeed: 2500,
                autoplayTimeout: 2500,
                smartSpeed: 2500,
                lazyLoad: false,
                slideTransition: 'linear',
                onTranslate: removeActive,
                responsive: {
                    1440: {
                        items: 8,
                        margin: 40,
                    },
                    1200: {
                        items: 8,
                        margin: 20,
                    },
                    992: {
                        items: 7,
                    },
                    768: {
                        items: 4,
                        center: false,
                        touchDrag: false,
                        mouseDrag: false,
                    },
                    500: {
                        touchDrag: false,
                        mouseDrag: false,
                        items: 3
                    }
                }
            });
            $('.brands-slider').on('changed.owl.carousel', function(event) {
                $('.brands-slider .owl-item').removeClass('active');
                $('.brands-slider .owl-item').removeClass('cloned');
                $('.brands-slider .owl-item').removeClass('center');
            })

        }

        // if($(window).width() < 1200){
        //     if( $('.brands-slider-projects').length ) {
        //         $('.brands-slider-projects').owlCarousel({
        //             center: true,
        //             items: 2,
        //             loop: true,
        //             margin: 12,
        //             dots: false,
        //             autoplay: true,
        //             autoplaySpeed: 1500,
        //             autoplayTimeout: 1500,
        //             smartSpeed: 1500,
        //             lazyLoad: true,
        //             slideTransition: 'linear',
        //             responsive: {
        //                 1440: {
        //                     items: 8,
        //                     margin: 30,
        //                 },
        //                 1360: {
        //                     items: 8,
        //                     margin: 20,
        //                 },
        //                 992: {
        //                     items: 7,
        //                 },
        //                 768: {
        //                     items: 4,
        //                     center: false
        //                 },
        //                 500: {
        //                     items: 3
        //                 }
        //             }
        //         });
        //     }
        //     if( $('.content__section-projectsfull__accordion-item__slider').length ) {
        //         if($('.content__section-projectsfull__accordion-item__slider').hasClass('about__slider')){
        //             $('.about__slider').owlCarousel({
        //                 onTranslate: translateSlider,
        //                 onInitialize: initSliderN,
        //                 center: false,
        //                 items: 1,
        //                 loop: false,
        //                 margin: 0,
        //                 lazyLoad: true,
        //                 autoWidth: false,
        //                 dots: true,
        //                 nav: false,
        //                 responsive: {
        //                     768: {
        //                         items: 2,
        //                         margin: 20,
        //                     },
        //                     1200: {
        //                         items: 3,
        //                         nav: true,
        //                         dots: false,
        //                         navText: [
        //                             '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
        //                             '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
        //                         ],
        //                     },
        //                 }
        //             });
        //         }
        //         else {
        //             $('.content__section-projectsfull__accordion-item__slider').owlCarousel({
        //                 onTranslate: translateSlider,
        //                 onInitialize: initSliderN,
        //                 center: false,
        //                 items: 1,
        //                 loop: false,
        //                 margin: 0,
        //                 lazyLoad: true,
        //                 autoWidth: false,
        //                 dots: true,
        //                 nav: false,
        //                 responsive: {
        //                     1200: {
        //                         nav: true,
        //                         dots: false,
        //                         navText: [
        //                             '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
        //                             '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
        //                         ],
        //                     },
        //                 }
        //             });
        //         }
        //     }
        // }
        // else {
            if( $('.content__section-projectsfull__accordion-item__slider').length ) {
                if($('.content__section-projectsfull__accordion-item__slider').hasClass('about__slider')){
                    $('.content__section-projectsfull__accordion-item__slider').each(function() {
                        $(this).owlCarousel({
                            onInitialize: initSlider,
                            onTranslate: translateSlider,
                            center: false,
                            loop: false,
                            lazyLoad: true,
                            slideTransition: 'linear',
                            navText: [
                                '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
                                '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
                            ],
                            responsive: {
                                1199: {
                                    margin: 24,
                                    nav: true,
                                    dots: false,
                                    items: 2,
                                    autoWidth: true,
                                },
                                360: {
                                    margin: 0,
                                    nav: false,
                                    dots: true,
                                    autoWidth: false,
                                    items: 1,
                                }
                            }
                        });
                    });
                }
                else {
                    $('.content__section-projectsfull__accordion-item__slider').each(function() {
                        $(this).owlCarousel({
                            onInitialize: initSlider,
                            onTranslate: translateSlider,
                            center: false,
                            loop: false,
                            lazyLoad: true,
                            slideTransition: 'linear',
                            navText: [
                                '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
                                '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
                            ],
                            responsive: {
                                1199: {
                                    margin: 24,
                                    nav: true,
                                    dots: false,
                                    items: 2,
                                    autoWidth: true,
                                },
                                360: {
                                    margin: 0,
                                    nav: false,
                                    dots: true,
                                    autoWidth: false,
                                    items: 1,
                                }
                            }
                        });
                    });
                }
            }
        // }

        if( $('.slider').length ) {
            $('.slider').each(function() {
                $(this).owlCarousel({
                    onInitialize: initSlider,
                    onTranslate: translateSlider,
                    center: false,
                    items: 2,
                    loop: false,
                    margin: 20,
                    nav: false,
                    dots: true,
                    lazyLoad: true,
                    slideTransition: 'linear',
                    autoWidth: true,
                    navText: [
                        '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.61808 13.3344C4.14394 12.929 3.41535 12.9902 2.99075 13.471C2.56614 13.9518 2.60629 14.6702 3.08044 15.0756L8.13743 19.4802C8.61158 19.8856 9.34014 19.8245 9.76475 19.3436C10.1894 18.8628 10.1492 18.1444 9.67506 17.739L4.61808 13.3344ZM0.448401 10.3885C0.436176 10.3762 0.424248 10.3638 0.412618 10.3513C0.193608 10.1479 0.0585194 9.8556 0.0622973 9.52937C0.0641221 9.37171 0.0982098 9.22123 0.15821 9.08427C0.20734 8.96593 0.27834 8.85575 0.371443 8.75959C0.390478 8.73908 0.410243 8.71925 0.430692 8.70015L8.26251 0.868157C8.69767 0.432993 9.43233 0.462127 9.90342 0.93323C10.3745 1.40433 10.4036 2.13901 9.96849 2.57417L4.1976 8.34519L25.2671 8.04132C25.8901 8.03411 26.3892 8.53326 26.382 9.1562C26.3748 9.77914 25.8639 10.29 25.241 10.2972L1.17718 10.6443C0.901002 10.6475 0.649162 10.5511 0.454984 10.3886L0.448401 10.3885Z"/></svg>',
                        '<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m 21.826217,6.9739144 c 0.47414,0.4054 1.20273,0.3442 1.62733,-0.1366 0.42461,-0.4808 0.38446,-1.1992 -0.08969,-1.6046 l -5.05699,-4.40459996 c -0.47415,-0.4054 -1.20271,-0.3443 -1.62732,0.1366 -0.42465,0.48079996 -0.38445,1.19919996 0.08969,1.60459996 z m 4.169679,2.9459 c 0.01223,0.0123 0.02415,0.0247 0.03578,0.0372 0.21901,0.2033996 0.354099,0.4956996 0.350321,0.8219296 -0.0018,0.15766 -0.03591,0.30814 -0.09591,0.4451 -0.04913,0.11834 -0.12013,0.22852 -0.213233,0.32468 -0.01903,0.02051 -0.0388,0.04034 -0.05925,0.05944 l -7.831817,7.831993 c -0.43516,0.435164 -1.16982,0.40603 -1.64091,-0.06507 -0.47108,-0.4711 -0.50018,-1.20578 -0.06507,-1.64094 l 5.77089,-5.77102 -21.0695,0.30387 c -0.62299999,0.0072 -1.12209999,-0.49194 -1.11489999,-1.11488 0.0072,-0.62294 0.5181,-1.1338 1.14099999,-1.141 l 24.06382,-0.3470996 c 0.276178,-0.0032 0.528018,0.0932 0.722196,0.2557 z" /></svg>'
                    ],
                    responsive: {
                        1650: {
                            margin: 40,
                            nav: true,
                            dots: false,
                        },
                        1200: {
                            margin: 24,
                            nav: true,
                            dots: false,
                        },
                        992: {
                            margin: 20,
                            nav: true,
                            dots: false,
                        },
                        768: {
                            margin: 15,
                        }
                    }
                });
            });
        }

        initSliderSolution();
    });

    $(window).resize(function() {
        initSliderSolution();
    });


    /**
     * Functions
     */
    function initSliderSolution() {
        if( $('.solution-section').length < 1 ) {
            return false;
        }

        if( $(window).outerWidth( true ) < 992 ) {
            $('.solution-section').owlCarousel({
                onTranslate: translateSlider,
                center: false,
                items: 2,
                loop: false,
                margin: 20,
                // mouseDrag: true,
                autoWidth: true,
                dots: true,
                dotsEach: true,
                responsive: {
                    701: {
                        items: 4,
                        center: false,
                        margin: 20,
                        // mouseDrag: true,
                        dots: true,
                    },
                    600: {
                        items: 3,
                        center: false,
                        margin: 20,
                        // mouseDrag: true,
                        dots: true,
                    }
                }
            });
        } else {
            if( $('.solution-section').hasClass('owl-loaded') ) {
                $('.solution-section').trigger('destroy.owl.carousel');
            }
        }
    }

    function initSlider( event ) {
        const currentSlideBlock = $(event.target).closest('.slider-container').find('.count .total');
        let totalSlides = $(event.target).find('.slider-item').length - 1;
        totalSlides = ( totalSlides > 0 ) ? totalSlides : 0;
        currentSlideBlock.text( totalSlides );
    }

    function removeActive( event ) {
        $('.brands-slider .owl-item').removeClass('active');
        $('.brands-slider .owl-item').removeClass('cloned');
        $('.brands-slider .owl-item').removeClass('center');
    }

    function translateSlider( event ) {
        const $target = event.target;
        const $className = $target.className;

        if( $className.indexOf('slider') !== -1 ) {
            const currentSlideBlock = $( $target ).closest('.slider-container').find('.count .current');
            let currentSlide = 0;
            currentSlide = event.item.index + 1;
            currentSlideBlock.text( currentSlide );
        }
    }

    function initSliderN( event ) {
        const currentSlideBlock = $(event.target).closest('.slider-container').find('.count .total');
        let totalSlides = $(event.target).find('.slider-item').length;
        totalSlides = ( totalSlides > 0 ) ? totalSlides : 0;
        currentSlideBlock.text( totalSlides );
    }

})(jQuery);


const convertImagesToSVG = (query, callback) => {
    if(query){
        const images = document.querySelectorAll(query);
        if(images){
            images.forEach(image => {
                if(image.src){
                fetch(image.src)
                    .then(res => res.text())
                    .then(data => {
                        const parser = new DOMParser();
                        const svg = parser.parseFromString(data, 'image/svg+xml').querySelector('svg');

                        if (image.id) svg.id = image.id;
                        if (image.className) svg.classList = image.classList;

                        image.parentNode.replaceChild(svg, image);
                    })
                    .then(callback)
                    .catch(error => console.error(error))
                }
            });
        }
    }
}

},{}],3:[function(require,module,exports){
require('owl.carousel');
require('./components/common.js');
},{"./components/common.js":2,"owl.carousel":1}]},{},[3]);
