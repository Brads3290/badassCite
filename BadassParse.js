/*** badassParse ***
 *  Usage: badassParse( {params} );
 *
 ** Parameters
 *   - mode: 'callback', 'ajax'
 *   - method: 'GET' or 'POST'
 *   - callback: if 'callback' mode, specify the callback function
 *   - url: The URL from which to fetch
 *   - timeout: The number of milliseconds to wait for a response
 *   - headers: an object containing key/value pairs for any request headers
 *   - postdata: a string or object representing key/value pairs to be sent as post data
 *    - a string value must be in an appropriate format, as it be sent as-is
 *    - an object will be translated into a 'key=value&foo=bar..' format
 *   - JSON_format: 'text', 'object', 'formatted_text', 'formatted_object'
 *   - JSON_whitelist: an array of values to return from the JSON
 *   - JSON_blacklist: an array of values to exclude from the JSON
 *   - JSON_replacer: a function to control the values included in the formatted JSON
 *    - must accept 'key' and 'value' arguments
 *    - whatever is returned will be the 'value' of the key in the JSON
 *     - if an object is returned, it will be recursively processed by the replacer function
 *     - if a function is returned, the value will be nothing
 *    - return 'undefined' to exclude the key from the JSON
 *   - JSON_spacer: the indentation to use in the formatted output
 *   - onSuccess: function to call back on success
 *    - Should accept a 'result' parameter (see below)
 *   - onFailure: function to call back on failure
 *    - Should accept a 'result' parameter (see below)
 *
 ** Callback 'result' object
 *   Success (passed to 'onSuccess' callback)
 *    - data: the data returned from the request
 *
 *   Failure (passed to 'onFailure' callback)
 *    - reason: if applicable, the reason for failure
 *    - data: if applicable, any data returned by the call
 *    - msg: the message associated with the failure, if applicable
 *    - status: if ajax request, this is the status returned
 */
(function () {
    function audit(obj) {
        return {
            require: function (list) {
                var failed = [];

                for (var i = 0; i < list.length; i++) {
                    if (!obj[list[i]]) {
                        failed.push(list[i]);
                    }
                }

                var ret = {
                    success: true,
                    failedItems: failed
                };

                if (failed.length > 0) {
                    ret.success = false;
                }

                return ret;
            }
        }
    }
    function setDefaults(obj) {
        return {
            to: function (defaults) {
                Object.keys(defaults).forEach(function (key) {
                    obj[key] = obj[key] || defaults[key];
                });
            }
        }
    }
    function formatFromText(params, data) {
        function format(data) {
            //Implement whitelist
            if (params['JSON_whitelist']) {
                var wl_tmpData = {};
                Object.keys(data).forEach(function (key) {
                    if (params['JSON_whitelist'][key] !== undefined) {
                        wl_tmpData[key] = data[key];
                    }
                });

                data = wl_tmpData;
            }

            //Implement blacklist
            if (params['JSON_blacklist']) {
                var bl_tmpData = {};
                Object.keys(data).forEach(function (key) {
                    if (params['JSON_blacklist'][key] === undefined) {
                        bl_tmpData[key] = data[key];
                    }
                });

                data = bl_tmpData;
            }

            return JSON.stringify(data, params['JSON_replacer'] || null, params['JSON_spacer'] || '\t');
        }

        if (data instanceof String) {
            data = JSON.parse(data);
        }

        switch (params["JSON_format"]) {
            case "text": {
                return data;
            }
            case "object": {
                return data;
            }
            case "formatted_text": {
                return format(data);
            }
            case "formatted_object": {
                return JSON.parse(format(data));
            }
            default: {
                throw {
                    msg: "badassParse - invalid value of 'format': \"" + params.format + "\""
                }
            }
        }
    }
    function callbackAPI(params) {
        var scr = document.createElement('script');
        scr.src = params.url;

        var serverResponse = false;
        var evt = scr.addEventListener('load', function () {
            serverResponse = true;
        });

        window[params['callback']] = function (data) {
            try {
                data = formatFromText(params, data);
            } catch (e) {
                params.onFailure({
                    msg: e.msg || e.message || e.err || e.error || e,
                    data: data,
                    reason: 'error'
                });
            }

            document.head.removeChild(scr);

            params.onSuccess({
                data: data
            })
        };

        window.setTimeout(function () {
            if (!serverResponse) {
                params['onFailure']({
                    msg: "badassParse - request timed out",
                    data: null,
                    reason: 'timeout'
                });

                document.head.removeChild(scr);
                scr.removeEventListener('load', evt);
            }
        }, params['timeout']);

        document.head.appendChild(scr);
    }
    function ajaxAPI(params) {
        var req = new XMLHttpRequest();
        req.timeout = params['timeout'];
        req.addEventListener('readystatechange', function () {
            if (req.readyState === 4) {
                if (req.status !== 200) {
                    params['onFailure']({
                        msg: "badassParse - request did not succeed",
                        data: null,
                        reason: 'error',
                        status: req.status
                    });
                } else {
                    var data = null;
                    try {
                        data = formatFromText(params, req.responseText);
                    } catch (e) {
                        params.onFailure({
                            msg: e.msg || e.message || e.err || e.error || e,
                            data: data,
                            reason: 'error'
                        });
                    }

                    params.onSuccess({
                        data: data
                    });
                }
            }
        });
        req.addEventListener('timeout', function() {
            req.abort();

            params['onFailure']({
                msg: "badassParse - request timed out",
                data: null,
                reason: 'timeout'
            });
        });

        req.open(params["method"], params['url'], true);

        if (params['headers']) {
            Object.keys(params['headers']).forEach(function (key) {
                req.setRequestHeader(key, params['headers'][key]);
            });
        }

        var postdata = null;
        if (params['postdata']) {
            if (params['postdata'] instanceof String) {
                postdata = params['postdata'];
            } else {
                var objKeys = Object.keys(params['postdata']);
                var len = objKeys.length;
                postdata = "";
                objKeys.forEach(function (key) {
                    postdata += encodeURIComponent(key) + "=" + encodeURIComponent(params['postdata'][key]);
                    
                    if (--len > 0) {
                        postdata += '&';
                    }
                });
            }
        }

        req.send(postdata);
    }

    window.badassParse = function (params) {
        //Check that all required parameters exist
        var auditResult = audit(params).require(['url', 'mode']);

        setDefaults(params).to({
            timeout: 2000,
            JSON_format: 'text',
            method: "GET",
            onSuccess: function () {},
            onFailure: function () {}
        });

        if (!auditResult.success) {
            throw {
                msg: "badassParse - missing required parameters: [" + auditResult.failedItems.toString() + "]"
            }
        }

        switch (params.mode) {
            case "callback": {
                if (!params['callback']) {
                    throw {
                        msg: "badassParse - 'mode: callback' was specified but no callback function was given."
                    }
                }

                callbackAPI(params);
                break;
            }
            case "ajax": {
                ajaxAPI(params);
                break;
            }
            default: {
                throw {
                    msg: "badassParse - invalid value for 'mode': \"" + params.mode + "\""
                }
            }
        }
    }
}());