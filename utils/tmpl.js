jQuery.tmpl = {
	VARS: {},

	attr: {
		"data-ensure": function( elem, ensure ) {
			return function( elem ) {
				return !!(ensure && jQuery.tmpl.getVAR( ensure ));
			};
		},

		"data-if": function( elem, value ) {
			value = value && jQuery.tmpl.getVAR( value );

			jQuery( elem ).next().data( "lastCond", value );

			if ( !value ) {
				return null;
			}
		},

		"data-else-if": function( elem, value ) {
			var lastCond = jQuery( elem ).data( "lastCond" );

			value = !lastCond && value && jQuery.tmpl.getVAR( value );

			jQuery( elem ).next().data( "lastCond", lastCond || value );

			if ( !value ) {
				return null;
			}
		},

		"data-else": function( elem ) {
			if ( jQuery( elem ).data( "lastCond" ) ) {
				return null;
			}
		},

		"data-each": function( elem, value ) {
			var match;

			jQuery( elem ).removeAttr( "data-each" );

			if ( (match = /^(.*?)(?: as (?:(\w+), )?(\w+))?$/.exec( value )) ) {
				return {
					items: jQuery.tmpl.getVAR( match[1] ),

					value: match[3],
					pos: match[2],

					oldValue: jQuery.tmpl.VARS[ match[3] ],
					oldPos: jQuery.tmpl.VARS[ match[2] ]
				};
			}
		}
	},

	type: {
		"var": function( elem, value ) {
			if ( !value && elem.getElementsByTagName("*").length > 0 ) {
				return function( elem ) {
					return jQuery.tmpl.type["var"]( elem, elem.innerHTML );
				};
			}

			var name = elem.id;

			value = value || jQuery.tmpl.getVAR( elem );

			// If a name was specified then we're going to load the value
			if ( name ) {

				function setVAR( name, value ) {
					// Show an error if a variable definition is overriding a built-in method
					if ( KhanUtil[ name ] || ( typeof present !== "undefined" && ( typeof present[ name ] === "function" ) ) ) {
						Khan.error( "Defining variable '" + name + "' overwrites utility property of same name." );
					}

					jQuery.tmpl.VARS[ name ] = value;
				}

				// Destructuring an array?
				if ( name.indexOf( "," ) !== -1 ) {
					var parts = name.split(/\s*,\s*/);

					jQuery.each( parts, function( i, part ) {
						// Ignore empty parts
						if ( part.length > 0 ) {
							setVAR( part, value[i] );
						}
					});

				// Just a normal assignment
				} else {
					setVAR( name, value );
				}

			// No value was specified so we replace it with a text node of the value
			} else {
				return document.createTextNode( value != null ?
					value + "" :
					"" );
			}
		},

		ul: function( elem ) {
			if ( elem.id ) {
				return jQuery( "<var>" )
					.attr( "id", elem.id )
					.append( jQuery( elem ).children().getRandom().contents() )[0];
			}
		},

		code: function( elem ) {
			return function( elem ) {
				var $elem = jQuery( elem );

				// Maintain the classes from the original element
				if ( elem.className ) {
					$elem.wrap( "<span class='" + elem.className + "'></span>" );
				}

				// Trick MathJax into thinking that we're dealing with a script block
				elem.type = "math/tex";

				// Make sure that the old value isn't being displayed anymore
				elem.style.display = "none";

				// Clean up any strange mathematical expressions
				var text = $elem.text();
				$elem.text( KhanUtil.cleanMath ? KhanUtil.cleanMath( text ) : text );

				// Stick the processing request onto the queue
				if ( typeof MathJax !== "undefined") {
					MathJax.Hub.Queue([ "Typeset", MathJax.Hub, elem ]);
				}
			};
		}
	},

	getVAR: function( elem, ctx ) {
		// We need to compute the value
		var code = jQuery.trim( elem.nodeName ? jQuery(elem).text() : elem );

		// Make sure any HTML formatting is stripped
		code = jQuery.tmpl.cleanHTML( code );

		// See if we're dealing with a multiline block of code
		if ( /;/.test( code ) && !/\bfunction\b/.test( code ) ) {
			code = "(function(){\n" + code + "\n})()";
		}

		// If no extra context was passed, use an empty object
		if ( ctx == null ) {
			ctx = {};
		}

		try {
			// Use the methods from JavaScript's built-in Math methods
			with ( Math ) {
				// And the methods provided by the library
				with ( KhanUtil ) {
					// And the passed-in context
					with ( ctx ) {
						// And all the computed variables
						with ( jQuery.tmpl.VARS ) {
							return eval( "(" + code + ")" );
						}
					}
				}
			}

		} catch( e ) {
			Khan.error( code, e );
		}
	},

	// Make sure any HTML formatting is stripped
	cleanHTML: function( text ) {
		return text.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
	}
};

if ( typeof KhanUtil !== "undefined" ) {
	KhanUtil.tmpl = jQuery.tmpl;
}

jQuery.fn.tmpl = function() {
	for ( var i = 0, l = this.length; i < l; i++ ) {
		traverse( this[i] );
	}

	return this;

	function traverse( elem ) {
		var post = [],
			child = elem.childNodes,
			ret = process( elem, post );

		if ( ret === null ) {
			if ( elem.parentNode ) {
				elem.parentNode.removeChild( elem );
			}

			return ret;

		} else if ( ret === false ) {
			return traverse( elem );

		} else if ( ret && ret.nodeType && ret !== elem ) {
			if ( elem.parentNode ) {
				elem.parentNode.replaceChild( ret, elem );
			}

			elem = ret;

		} else if ( ret.items ) {
			var origParent = elem.parentNode,
				origNext = elem.nextSibling;

			jQuery.each( ret.items, function( pos, value ) {
				if ( ret.value ) {
					jQuery.tmpl.VARS[ ret.value ] = value;
				}

				if ( ret.pos ) {
					jQuery.tmpl.VARS[ ret.pos ] = pos;
				}

				var clone = jQuery( elem ).detach().clone( true )[0];

				if ( origNext ) {
					origParent.insertBefore( clone, origNext );
				} else {
					origParent.appendChild( clone );
				}

				traverse( clone );
			});

			if ( ret.value ) {
				jQuery.tmpl.VARS[ ret.value ] = ret.oldValue;
			}

			if ( ret.pos ) {
				jQuery.tmpl.VARS[ ret.pos ] = ret.oldPos;
			}

			return;
		}

		// loop through children if not null
		for ( var i = 0; i < child.length; i++ ) {
			if ( child[i].nodeType === 1 && traverse( child[i] ) === null ) {
				i--;
			}
		}

		for ( var i = 0, l = post.length; i < l; i++ ) {
			if ( post[i]( elem ) === false ) {
				return traverse( elem );
			}
		}

		return elem;
	}

	function process( elem, post ) {
		var ret, newElem,
			$elem = jQuery( elem );

		for ( var attr in jQuery.tmpl.attr ) {
			var value = $elem.attr( attr );

			if ( value !== undefined ) {
				ret = jQuery.tmpl.attr[ attr ]( elem, value );

				if ( typeof ret === "function" ) {
					post.push( ret );

				} else if ( ret && ret.nodeType ) {
					newElem = ret;

				} else if ( ret !== undefined ) {
					return ret;
				}
			}
		}

		if ( newElem ) {
			elem = newElem;
		}

		var type = elem.nodeName.toLowerCase();
		if ( jQuery.tmpl.type[ type ] != null ) {
			ret = jQuery.tmpl.type[ type ]( elem );

			if ( typeof ret === "function" ) {
				post.push( ret );
			}
		}

		return ret === undefined ? elem : ret;
	}
};

jQuery.fn.tmplLoad = jQuery.fn.tmpl;

jQuery.fn.extend({
	tmplApply: function( options ) {
		options = options || {};

		// Get the attribute which we'll be checking, defaults to "id"
		// but "class" is sometimes used
		var attribute = options.attribute || "id",

			// Figure out the way in which the application will occur
			defaultApply = options.defaultApply || "replace",

			// Store for elements to be used later
			parent = {};

		return this.each(function() {
			var $this = jQuery( this ),
				name = $this.attr( attribute ),
				hint = $this.data( "apply" ) && !$this.data( "apply" ).indexOf( "hint" );

			// Only operate on the element if it has the attribute that we're using
			if ( name ) {
				// The inheritance only works if we've seen an element already
				// that matches the particular name and we're not looking at hint
				// templating
				if ( name in parent && !hint ) {
					// Get the method through which we'll be doing the application
					// You can specify an application style directly on the sub-element
					jQuery.tmplApplyMethods[ $this.data( "apply" ) || defaultApply ]

						// Call it with the context of the parent and the sub-element itself
						.call( parent[ name ], this );

				// Store the parent element for later use if it was inherited from somewhere else
				} else if ( $this.data( "inherited") ) {
					parent[ name ] = this;
				}
			}
		});
	}
});

jQuery.extend({
	// These methods should be called with context being the parent
	// and first argument being the child.
	tmplApplyMethods: {
		// Removes both the parent and the child
		remove: function( elem ) {
			jQuery( this ).remove();
			jQuery( elem ).remove();
		},

		// Replaces the parent with the child
		replace: function( elem ) {
			jQuery( this ).replaceWith( elem );
		},

		// Replaces the parent with the child's content. Useful when
		// needed to replace an element without introducing additional
		// wrappers.
		splice: function( elem ) {
			jQuery( this ).replaceWith( jQuery( elem ).contents() );
		},

		// Appends the child element to the parent element
		append: function( elem ) {
			jQuery( this ).append( elem );
		},

		// Appends the child element's contents to the parent element.
		appendContents: function( elem ) {
			jQuery( this ).append( jQuery( elem ).contents() );
			jQuery( elem ).remove();
		},

		// Prepends the child element to the parent.
		prepend: function( elem ) {
			jQuery( this ).prepend( elem );
		},

		// Prepends the child element's contents to the parent element.
		prependContents: function( elem ) {
			jQuery( this ).prepend( jQuery( elem ).contents() );
			jQuery( elem ).remove();
		},

		// Insert child before the parent.
		before: function( elem ) {
			jQuery( this ).before( elem );
		},

		// Insert child's contents before the parent.
		beforeContents: function( elem ) {
			jQuery( this ).before( jQuery( elem ).contents() );
			jQuery( elem ).remove();
		},

		// Insert child after the parent.
		after: function( elem ) {
			jQuery( this ).after( elem );
		},

		// Insert child's contents after the parent.
		afterContents: function( elem ) {
			jQuery( this ).after( jQuery( elem ).contents() );
			jQuery( elem ).remove();
		},

		// Like appendContents but also merges the data-ensures
		appendVars: function( elem ) {
			jQuery.tmplApplyMethods.appendContents.call( this, elem );

			var parentEnsure = jQuery( this ).data("ensure") || "1";
			var childEnsure = jQuery( elem ).data("ensure") || "1";
			jQuery( this ).data("ensure",
				"(" + parentEnsure + ") && (" + childEnsure + ")");
		}
	}
});
