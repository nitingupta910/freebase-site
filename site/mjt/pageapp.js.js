/*
 * Copyright 2010, Google Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 *  fragments of an in-browser application framework.
 *
 *  the initial model is that an application's initial state
 *  is contained in the query section of the uri using
 *  form-urlencoding.  the query section of the uri is
 *  decoded into the mjt.urlquery object when the application
 *  is initialized.  you can change application state by
 *  navigating to the same page with a different query uri.
 *  this works with a standard webserver because apache ignores
 *  the query part of the uri when serving an html file from the
 *  filesystem.
 *
 *  later, support was added for the yahoo ui history manager
 *  <http://developer.yahoo.com/yui/history/>.
 *  this makes it possible to change the state of the app
 *  without a page reload.
 *
 *  the yui history code has many advantages but
 *  the uris generated by yui history are extremely ugly.
 *  in a future version of mjt, i hope to override that
 *  part of yui.
 *
 *  uses  formencode, formdecode, vthunk, log, warn, uniqueid, Task.debug, ...
 *
 */

(function(mjt){

/**
 *  a mjt application with history management.
 *
 *  one of these will be created and available as "mjt.app".
 */

mjt.App = function (argschema) {
    if (typeof argschema == 'undefined')
        argschema = {};

    this.state = null;
    this.yui_history_id = 'mjtapp';


    //mjt.log('new Mjt.App');

    this.argschema = {
            'mjt.server': {
                key: 'mjt.server',
                statekey: 'service_url',
                validator: mjt.validators.service_host
            },
            'mjt.debug': {
                key: 'mjt.debug',
                statekey: 'debug',
                validator: mjt.validators.flag
            }
    };

    for (var k in argschema) {
        this.argschema[k] = argschema[k];
    }

    // callbacks for state change notification
    this._onstatechange = {};

    this.init();
};

/**
 *  initialize the application
 *
 *  this should be done early (before onload())
 *
 */
mjt.App.prototype.init = function () {
    this.init_state();

    //mjt.log('Mjt.App.init', this.state);

    // XXX these should be triggered by onstatechange
    mjt.service_url = this.state.service_url;

    // this is kind of ugly here.  where should mjt.freebase
    //  be initialized?
    mjt.freebase.set_service_url(this.state.service_url);
    mjt.debug = this.state.debug;
    mjt.Task.debug = this.state.debug; //WILL: how could we specify these separately?
    mjt.urlquery = this.state;

    return this;
};


/**
 *  register an onstatechange handler
 *
 */
mjt.App.prototype.onstatechange = function (THUNK_ARGS) {
    var tid = mjt.uniqueid('statecb');
    this._onstatechange[tid] = mjt.vthunk(arguments);
    return this;
};


/**
 *  notify all onstatechange handlers
 *
 */
mjt.App.prototype.refresh = function () {
    for (var k in this._onstatechange) {
        this._onstatechange[k].apply(this, []);
    }
    return this;
};


/**
 *  handler for yui history events
 *
 */
//   init/forward/back changes.
// not called for explicit mark_history()
mjt.App.prototype._handle_onhistory = function (rstate) {
    mjt.log('yui setting state', rstate, typeof this.state);

    if (rstate === null) {
        rstate = YAHOO.util.History.getCurrentState(this.yui_history_id);
        mjt.log('yui history onLoadEvent:', rstate);
    } else {
        mjt.log('yui history state:', rstate);
    }

    this.state = rison.decode_object(rstate);
    this.refresh();
};

// see http://developer.yahoo.com/yui/history/
// must be called early!
mjt.App.prototype.init_state = function () {
    // parse the query sections of the url, if present.
    var qstr;
    var qstate = null;

    if (typeof window != 'undefined')
        qstr = window.location.search;
    if (typeof acre != 'undefined')
        qstr = acre.environ.query_string;

    if (typeof(qstr) == 'string' && qstr.length > 0 && qstr.charAt(0) == '?')
        this.state = qstate = this.decode_uristate(qstr.substr(1));
    else
        this.state = this.decode_uristate('');

    // if yui history isn't loaded, we're done
    if (typeof YAHOO === 'undefined' || !YAHOO.util.History)
        return this;

    // otherwise, initialize yui history
    var history = YAHOO.util.History;

    // yui history mechanism overrides query args
    var init_state = history.getBookmarkedState(this.yui_history_id);
    if (!init_state) {
        init_state = rison.encode_object(this.state);
    }

    mjt.log('yui history initial state', init_state);

    history.register(this.yui_history_id, init_state,
                     mjt.vthunk('_handle_onhistory', this));

    if (qstate !== null) {
        // XXX should probably set document.location to clear the
        // query section of the uri, since yui history will be
        // managing state instead and having the initial state in
        // the query section of the url is just confusing.
        // this is tricky to do politely - revisit when beautifying yui urls.
    }

    // callback for forward/back events
    history.onLoadEvent.subscribe(mjt.vthunk('_handle_onhistory', this, null));

    // must be done last
    // XXX these should not need to be hardcoded
    history.initialize('yui-history-iframe', 'yui-history-field');

    return this;
};



/**
 *  make sure that the current app state is bookmarkable
 *
 */
mjt.App.prototype.mark_history = function () {
    if (this.yui_history_id === null) {
        // XXX should set document.location?
        return;
    }

    var rstate = rison.encode_object(this.state);
    //mjt.warn('NAV', this.yui_history_id, rstate);
    YAHOO.util.History.navigate(this.yui_history_id, rstate);
};






mjt.Validator = function () {
};
mjt.Validator.prototype.encode = function (v) {
    if (v == this.default_value)
        return undefined;
    return this.encodestr(v);
};
mjt.Validator.prototype.decode = function (v) {
    if (typeof v == 'undefined')
        return this.default_value;
    return this.decodestr(v);
};

mjt.validators = {};

/**
 *  a flag validator translates a flag from a query uri
 */
mjt.validators.flag = new mjt.Validator();
mjt.validators.flag.default_value = false;
mjt.validators.flag.encodestr = function (bool) {
    return bool ? '1' : undefined;
};
mjt.validators.flag.decodestr = function (str) {
    return str == '1' ? true : false;
};


/**
 *  a service_host validator translates a service host from a query uri
 *   it abbreviates it if possible to keep the uri short and legible.
 */
mjt.validators.service_host = new mjt.Validator();
// XXX abstract this out
mjt.validators.service_host.default_value = 'http://www.freebase.com';

/**
 * construct a short name for a service host.
 * takes the server url, strips off any "http://" prefix,
 * and abbreviates the server which served this page as ".".
 *
 * @param server URI  the URI for the server
 * @returns string    a short name for the server
 *
 */
mjt.validators.service_host.encodestr = function (server) {
    var host = server.replace(/^http:\/\//, '');

    if (typeof window != 'undefined'
        && host == window.location.host)
        return '.';

    return host;
};

mjt.validators.service_host.decodestr = function (server) {
    if (server.substr(0,4) == 'http')
        url = server;
    else if (server == '.') {
        if (typeof window != 'undefined')
            url = window.location.protocol + '//' + window.location.host;
        if (typeof acre != 'undefined')
            url = acre.environ.server_protocol + '//' + acre.environ.host
    } else
        url = 'http://' + server;
    return url;
};





/*
// get/set using dot-separated paths through the js object graph
mjt.App.prototype.jsvar_getset = function (varpath, value) {
    // locate var
    var objpath = argspec.jsvar.split('.');

    var obj = window;
    var key;
    key = objpath.shift();
    if (key == '') {
        obj = this.state;
        key = objpath.shift();
    }

    while (objpath.length > 0)  {
        obj = obj[key];
        key = objpath.shift();
    }

    if (typeof value == 'undefined')
        return obj[key];

    obj[key] = value;
    return value;
};
*/


/**
 *  encode the app state into a string, suitable for use in a uri
 *
 *  this is complicated by the desire to have human-readable
 *  uris and by a certain amount of legacy cruft.
 *
 *  values should be a dict overriding the *state* value
 *
 */
mjt.App.prototype.encode_uristate = function(values) {
    var qd = {};
    var state_encoded = {};
    var k, argspec;

    // build a dict of args by statekey
    var args_by_statekey = {}
    for (k in this.argschema) {
        argspec = this.argschema[k];
        args_by_statekey[argspec.statekey] = argspec;
    }

    // build the url query dict
    for (k in this.state) {
        argspec = args_by_statekey[k];
        if (typeof argspec != 'undefined')
            qd[argspec.key] = argspec.validator.encode(this.state[k]);
        else
            qd[k] = this.state[k];
    }

    // override from the values array
    for (k in values) {
        argspec = args_by_statekey[k];
        if (typeof argspec != 'undefined')
            qd[argspec.key] = argspec.validator.encode(values[k]);
        else
            qd[k] = values[k];
    }

    // strip any undefined values that might have gotten in there.
    for (k in qd) {
        if (typeof qd[k] == 'undefined')
            delete qd[k];
    }

    return mjt.formencode(qd);
};


mjt.App.prototype.decode_uristate = function(qstr) {
    var state = {};
    var qd = mjt.formdecode(qstr);
    var argspec, k;

    for (k in qd) {
        argspec = this.argschema[k];
        if (typeof argspec != 'undefined')
            state[argspec.statekey] = argspec.validator.decode(qd[k]);
        else
            state[k] = qd[k];
    }

    // defaults
    for (k in this.argschema) {
        argspec = this.argschema[k];
        var skey = argspec.statekey;
        if (!(skey in state))
            state[skey] = argspec.validator.default_value;
    }

    return state;
};



/**
 * create a url that propagates the mjt application state.
 *
 * for use primarily if yui history is not present
 *
 * @param base    URI     the base url, with no query or fragment component
 * @param values  Object  additional state to encode into the query component
 * @returns       URI     a URI constructed from base, values, and
 *                        the current mjt application state.
 *
 */
// was mjt.form_mjt_url
mjt.App.prototype.href = function(base, values) {
    if (typeof base == 'undefined' || base === null)
        base = location.protocol + '//' + location.host + location.pathname;
    var qstr = this.encode_uristate(values);
    return base + (qstr ? '?' + qstr : '');
};


})(mjt);
