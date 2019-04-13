if(typeof Marionette !== 'undefined') {
    /**
     * Create review in the backend from form data
     */
    var PromoReviewController = Marionette.Object.extend({
        formID: 0,

        formModel: {},

        initialize: function() {
            Backbone.Radio.channel( 'form-4' ).reply( 'maybe:submit', this.createReviews, this, 4 );
        },

        createReviews: function( formModel ) {

            if( formModel.getExtra( 'review_created' ) ) return true;

            this.formID = formModel.get("id");
            this.formModel = formModel;
            var fields = ["hidden_customer_name", "review_promo_review", "hidden_product_id", "order_email1", "review_promo_rating", "review_id"];
            var fieldsByKey = {};
            for(var i=0; i<fields.length; i++) {
                var key = fields[i];
                var field = formModel.getFieldByKey(key);
                var val = field.get("value");
                var id = field.get("id");

                if (key == "hidden_product_id") {
                    val = /^\d+/.exec(val)[0];
                }

                fieldsByKey[key] = {
                    "val": val,
                    "id": id
                };
            }

            var _this = this;

            jQuery.ajax({
                url: ajax_posts.ajaxurl,
                type: 'post',
                data: {
                    action: 'promo_create_review',
                    security: ajax_posts.promononce,
                    fields: fieldsByKey
                },
                success: function(response) {
                    //if review (comment) id is returned, populate the appropriate field
                    jQuery("#nf-field-" + response.data.fieldId).val(response.data.reviewId);
                    nfRadio.channel( 'form-' + _this.formID ).request( 'add:extra', 'review_created', true );
                    nfRadio.channel( 'form-' + _this.formID ).request( 'submit', _this.formModel );
                }
            });

            // Halt form submission.
            return false;
        }

    });
}

if(typeof Marionette !== 'undefined') {
    /**
     * Modify field tooltip behavior
     */
    var modifyNFHelpTextBehavior = Marionette.Object.extend({
        initialize: function() {
            this.listenTo(nfRadio.channel("form"), "render:view", this.modifyHelpBehavior);
            nfRadio.channel("form").reply("init:help", this.modifyHelpBehavior);
        },

        modifyHelpBehavior: function(form_data) {
            jQuery(form_data.el).find(".nf-help").each(function() {
                jQuery(this).jBox("Tooltip", {
                    theme: "TooltipBorder",
                    content: jQuery(this).data("text"),
                    trigger: "click",
                    closeOnClick: "body",
                    fade: 500,
                })
            })
        }
    });

    /**
    * Set up field grouping for Ninja Forms (Very crude implementation)
    */
    var nwmFieldGrouping = Marionette.Object.extend( {
        initialize: function() {
            this.listenTo( nfRadio.channel( 'form' ), 'render:view', this.wrapGroups );
        },

        wrapGroups: function( view ) {
            var counter = 0;
            do {
                counter++;
                var current_group = jQuery(".field-group" + counter);
                jQuery(current_group).parent().wrapAll("<div class='promo-form-wrapper group-wrapper group" + counter + "-wrapper'></div>");
            } while (current_group.length > 0)
        }
    } );

    /**
    * Character counter for promo review page. All values and selectors are fixed
    */
    var nwmPromoReviewCharCounter = Marionette.Object.extend( {
        initialize: function() {
            this.listenTo( nfRadio.channel( 'form' ), 'render:view', this.addMinCharacterCount );

            //validate field count on form submit and field value change
            var submitChannel = Backbone.Radio.channel( 'submit' );
            this.listenTo( submitChannel, 'validate:field', this.validate );
            var fieldsChannel = Backbone.Radio.channel( 'fields' );
            this.listenTo( fieldsChannel, 'change:modelValue', this.validate );
        },

        /**
        * Updates the minimum characters
        *
        * Minimum characters 75. Selectors .promo-review-form textarea and .min-characters.
        *
        * @todo Add parameters to allow for any minimum character and any container/container selectors
        */
        minCharCounter: function() {
            var value = jQuery('.promo-review-form textarea').val(),
            minimum = 75;

            var regex = /\s+/gi;
            var charCount = value.trim().length;
            var difference = minimum - charCount

            if(difference >= 0) {
                jQuery(".min-characters").addClass("below-minimum");
            }

            if(difference <= 0) {
                jQuery('.min-characters').html(0);
            } else {
                jQuery('.min-characters').html(difference);
            }
        },

        /**
        * Add counter html and register events on it
        */
        addMinCharacterCount: function( view ) {
            if(jQuery(".promo-review-form textarea").length > 0) {
                jQuery(".promo-review-form textarea").after("<div class='min-character-container'><span class='min-characters'>75</span> characters to go!</div>");
                jQuery('.promo-review-form textarea').on("change keydown keypress keyup blur focus", this.minCharCounter);
            }
        },

        /**
        * Validate review field character length
        */
        validate: function( model ) {
            var fieldVal = model.get('value');
            var key = model.get('key');
            if(key == "review_promo_review") {
                if(fieldVal.trim().length < 75) {
                    var modelID       = model.get( 'id' );
                    var errorID       = 'too-few-characters';
                    var errorMessage  = 'Please write 75 characters or more.';
                    var fieldsChannel = Backbone.Radio.channel( 'fields' );

                    fieldsChannel.request( 'add:error', modelID, errorID, errorMessage );
                } else {
                    var modelID       = model.get( 'id' );
                    var errorID       = 'too-few-characters';
                    var fieldsChannel = Backbone.Radio.channel( 'fields' );

                    fieldsChannel.request( 'remove:error', modelID, errorID );
                }
            }
        }
    } );

    /**
    * Email validator. Do not allow people to enter their anonymized email addresses from Walmart or Amazon.
    */
    var nwmPromoReviewNoAnonymizedEmails = Marionette.Object.extend( {
        initialize: function() {
            var submitChannel = Backbone.Radio.channel( 'submit' );
            this.listenTo( submitChannel, 'validate:field', this.validate );
            var fieldsChannel = Backbone.Radio.channel( 'fields' );
            this.listenTo( fieldsChannel, 'change:modelValue', this.validate );
        },

        /**
        * Validate review field character length
        */
        validate: function( model ) {
            var fieldVal = model.get('value');
            var key = model.get('key');
            var modelID = model.get( 'id' );
            var errorID = 'anonymized-email';
            var fieldsChannel = Backbone.Radio.channel( 'fields' );

            if(key == "init_email") {
                if(fieldVal.indexOf("amazon") >= 0 || fieldVal.indexOf("walmart") >= 0) {
                    var errorMessage  = 'Please use the exact email address you used in your order.';
                    fieldsChannel.request( 'add:error', modelID, errorID, errorMessage );
                } else {
                    fieldsChannel.request( 'remove:error', modelID, errorID );
                }
            }
        }
    } );


    /**
     * Ensure proper formatting of the Amazon order number
     */
    var validateAmazonOrderNumberFormat = Marionette.Object.extend({
        initialize: function() {
            var submitChannel = Backbone.Radio.channel( 'submit' );
            this.listenTo( submitChannel, 'validate:field', this.validate );
            var fieldsChannel = Backbone.Radio.channel( 'fields' );
            this.listenTo( fieldsChannel, 'change:modelValue', this.validate );
        },

        validate: function(model) {
            var fieldsChannel = Backbone.Radio.channel( 'fields' );
            var fieldVal = model.get('value');
            var key = model.get('key');
            var fieldId = model.get("id");
            var errorID = "invalid-amazon-ordernum";
            var errorMessage = "Your order number will be 17 digits and may be entered with or without the dashes."

            if(key == "init_order_number") {
                var re = /^([^\d]*)(\d{3}(?:-|\s|_?)\d{7}(?:-|\s|_?)\d{7})([^\d]*)$/;
                var validOrdernum = re.test(fieldVal);
                if(!validOrdernum) {
                    fieldsChannel.request( 'add:error', fieldId, errorID, errorMessage );
                }  else {
                    var formatPieces = re.exec(fieldVal);
                    final = fieldVal;

                    if(formatPieces[1] != "" || formatPieces[3] !=  "") {
                        final = formatPieces[2];
                    }

                    if(final.split("-").length != 3) {
                        var justNums = fieldVal.replace(/(?:-|\s|_)/g, ""),
                        first = justNums.slice(0, 3),
                        middle = justNums.slice(3, 10),
                        last = justNums.slice(10),
                        final = first + "-" + middle + "-" + last;
                    }

                    jQuery( '#nf-field-' + fieldId ).val( final ).trigger( 'change' );

                    fieldsChannel.request( 'remove:error', fieldId, errorID );
                }
            }
        }
    });


    /**
    * Move promo review product title from inside the form to outside the form.
    */
    var nwmPromoReviewsProductTitle = Marionette.Object.extend( {
        initialize: function() {
            this.listenTo(nfRadio.channel( 'form' ), 'render:view', this.moveProductTitle);
        },

        moveProductTitle: function( view ) {
            //Move review form product title to outside the form
            if(jQuery(".hidden-review-product-title").length > 0) {
                if(jQuery(".review-product-title").length > 0) {
                    var product_title = jQuery(".hidden-review-product-title").text();
                    jQuery(".review-product-title").html(product_title);
                } else {
                    jQuery(".hidden-review-product-title").removeClass("hide-this");
                }
            }
        }
    } );

    /**
     * All actions before the first form is submitted
     *
     * This object was originally 2 separate objects. However, only the actions in one object would ever execute.
     * Running the actions one after the other rather than having them triggered independently ensures that
     * they all run.
     */
     /**V1**/
    var nwmPromoBeforeSubmitStepOne = Marionette.Object.extend({
        formID: 0,

        initialize: function() {
            Backbone.Radio.channel( 'form-2' ).reply( 'maybe:submit', this.preProcess, this, 2);
        },

        submitKlaviyoForm: function( formModel ) {
            if(jQuery(".klaviyo_submit_button").length > 0) {
                var formID = formModel.get("id");

                //if( formModel.getExtra( 'restart_promo_process' ) ) return true;
                var email = formModel.get('fields').findWhere({key: "init_email"}).get("value"),
                first_name = formModel.get('fields').findWhere({key: "init_firstname"}).get("value"),
                last_name = formModel.get('fields').findWhere({key: "init_lastname"}).get("value");
                if(email && first_name && last_name) {
                    jQuery("#k_id_email").val(email);
                    jQuery(".klaviyo_started_promo_review #first_name").val(first_name);
                    jQuery(".klaviyo_started_promo_review #last_name").val(last_name);
                    jQuery(".klaviyo_started_promo_review").submit();
                }
                //nfRadio.channel( 'form-' + formID ).request( 'add:extra', 'restart_promo_process', true );

                //nfRadio.channel( 'form-' + formID ).request( 'submit', formModel );
            }
        },

        /**
         * Check for an order using the email address
         *
         * @param {string} email
         *
         * @returns {object} A promise for the ajax call that checks for an order
         */
        getOrderByIdentifier: function(identifier, id_type, ordernum_displayed) {
            if(nwmSupportsES6) {
                return new Promise((resolve, reject) => {
                    jQuery.ajax({
                        url: ajax_posts.ajaxurl,
                        type: 'post',
                        data: {
                            action: 'promo_ajax_order_by_identifier',
                            identifier: identifier,
                            id_type: id_type,
                            ordernum_displayed: ordernum_displayed
                        }
                    })
                    .done((data) => resolve(data))
                    .fail((xhr, status, err) => reject({xhr: xhr, status: status, error: err}));
                });
            }
        },

        /**
         * Restart the form submission
         *
         * @param {int | string} formID
         */
        continuePromo: function(formID) {
            nfRadio.channel( 'form-' + formID ).request( 'add:extra', 'restart_promo_process_2', true );

            jQuery("#nf-form-" + formID + "-cont")
            .find(".submit-wrap input")
            .removeProp("disabled")
            .click();
        },

        /**
         * Refresh with the order number field displayed
         */
        displayOrdernumField: function() {
            var query = "?display-ordernum=1";
            if(this.customerFirst) query += "&firstname=" + this.customerFirst;
            if(this.customerLast) query += "&lastname=" + this.customerLast;
            if(this.customerEmail) query += "&email=" + this.customerEmail;
            var urlWithParam = window.location.href + query;
            window.location = urlWithParam;
        },

        /**
         * Populate address field
         */
        populateAddressString: function(address) {
            jQuery(".full-address input").val(address);
        },

        /**
         * Determine whether to display the order number field or send users to the next page
         *
         * Checks for an order with an AJAX call. Tries a promise-wrapped call, and
         * if the promise is not supported, tries the AJAX call by itself.
         *
         * @param {object} formModel Passed in from the initialize function
         */
        preProcess: function(formModel) {
            // var ordernum_displayed = window.location.search.includes("display-ordernum=1");
            var ordernum_displayed = true;
            // var id_type = "email";
            var id_type = "id";
            this.formID = formModel.get("id");
            this.customerFirst = formModel.get('fields').findWhere({key: "init_firstname"}).get("value");
            this.customerLast = formModel.get('fields').findWhere({key: "init_lastname"}).get("value");
            var _this = this;

            if(!ordernum_displayed || formModel.get('fields').findWhere({key: "init_order_number"}).get("value") == "") {
                var identifier = formModel.get('fields').findWhere({key: "init_email"}).get("value");
                this.customerEmail = identifier;
            } else {
                if(formModel.get('fields').findWhere({key: "init_order_number"}).get("value")) {
                    var identifier = formModel.get('fields').findWhere({key: "init_order_number"}).get("value");
                    id_type = "id";
                }
            }

            //if( ordernum_displayed || formModel.getExtra( 'restart_promo_process_2' ) ) return true;
            if(formModel.getExtra( 'restart_promo_process_2' )) return true;

            //this.submitKlaviyoForm(formModel);

            try {
                this.getOrderByIdentifier(identifier, id_type, ordernum_displayed).then(function(result) {
                    if(result.data.ordernum_displayed) {
                        if(jQuery(".order-id-field input").val() == "" && result.data.amz_order_id) {
                            jQuery(".order-id-field input").val(result.data.amz_order_id);
                        }
                        _this.populateAddressString(result.data.address);
                        jQuery(".order-status input").val(result.data.order_status);
                        _this.continuePromo(_this.formID);
                    } else {
                        if(result.success) {
                            if(result.data.amz_order_id) {
                                jQuery(".order-id-field input").val(result.data.amz_order_id);
                            }
                            _this.populateAddressString(result.data.address);
                            jQuery(".order-status input").val(result.data.order_status);
                            _this.continuePromo(_this.formID);
                        } else {
                            _this.displayOrdernumField();
                            return false;
                        }
                    }
                }).catch(function(errData) {
                    console.log(errData);
                    alert("Oh no! Something has gone terribly wrong. Please refresh the page and start again. If you continue to get this error message, please let us know.");
                    return false;
                });
                return false;
            } catch(error) {
                console.log(error);
                jQuery.ajax({
                    url: ajax_posts.ajaxurl,
                    type: 'post',
                    data: {
                        action: 'promo_ajax_order_by_identifier',
                        identifier: email,
                        id_type: "email",
                        esv: '<ES6'
                    }
                })
                .done(function(response) {
                    if(response.success) {
                        _this.populateAddressString(result.data.address);
                        jQuery(".order-status input").val(result.data.order_status);
                        _this.continuePromo(_this.formID);
                    } else {
                        _this.displayOrdernumField();
                    }
                })
                .fail(function(xhr, status, error) {
                    console.log(error);
                    console.log(xhr);
                    alert("Oh no! Something has gone terribly wrong. Please refresh the page and start again. If you continue to get this error message, please let us know.");
                });
            }

            return false;
        }
    });

    /**
     * Add processing overlay to forms on submit
     */
    var nwmPromoFormProcessingIndicator = Marionette.Object.extend({
        initialize: function() {
            this.listenTo( nfRadio.channel( 'form' ), 'render:view', this.insertProcessingOverlay );
            this.listenTo( nfRadio.channel( 'forms' ), 'before:submit', this.displayOverlay );
        },

        insertProcessingOverlay: function(view) {
            var formID = view.model.get("id");
            if(formID == 3) {
                jQuery(".vao-order-items-list").append("<div class='processing-overlay'><span class='spinner-position'><i class='fa fa-spinner'>");
            } else {
                jQuery("#nf-form-" + formID + "-cont").append("<div class='processing-overlay'><span class='spinner-position'><i class='fa fa-spinner'>");
            }
        },

        displayOverlay: function(formModel) {
            var formID = formModel.get("id");
            var errors = formModel.get("errors");
            if(errors.length === 0) {
                jQuery(".processing-overlay").addClass("show");
            }
        }
    });

    /**
     * Remove overlays on error return or state change
     */
    var removeProcessingOverlays = Marionette.Object.extend({
        initialize: function() {
            this.listenTo(nfRadio.channel("forms"), "submit:response", this.removeOverlays);
            this.listenTo(nfRadio.channel("forms"), "submit:response", this.showProgress);
        },

        removeOverlays: function(responseObject) {
            if((!!responseObject.errors && Object.keys(responseObject.errors).length > 0)
            || (!!responseObject.data.actions && !!responseObject.data.actions.success_message > 0)) {
                jQuery(".vao-order-items-list, .page-title").hide();
                jQuery(".processing-overlay").removeClass("show");
                jQuery(".identify-product").removeClass("hide-this-form");
            }
        },

        showProgress: function(responseObject) {
            jQuery("body:not(.review-promo-step-1)").addClass("lightbox-styled");
            jQuery(".current_step").addClass("full").removeClass("current_step").next().addClass("current_step");
        }
    });
}

(function($) {
    //initialize custom Ninja Forms Marionette objects
    if ($(".promo-review-form").length > 0 && typeof PromoReviewController != 'undefined') {
        new PromoReviewController();
    }

    new removeProcessingOverlays();
    new nwmPromoReviewCharCounter();
    new nwmFieldGrouping();
    new nwmPromoReviewsProductTitle();
    new nwmPromoReviewNoAnonymizedEmails();
    new nwmPromoBeforeSubmitStepOne();
    new nwmPromoFormProcessingIndicator();
    new validateAmazonOrderNumberFormat();
    new modifyNFHelpTextBehavior();
})(jQuery);
