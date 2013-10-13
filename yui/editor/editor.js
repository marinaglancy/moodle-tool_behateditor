// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Javascript for tool_behateditor
 *
 * @package    tool_behateditor
 * @copyright  2013 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

YUI.add('moodle-tool_behateditor-editor', function (Y) {

M.tool_behateditor = {

    /** @var string URL for AJAX requests */
    api : null,

    stepsdefinitions : {},

    featurefiles : {},

    textselectors : {},

    selectors : {},

    search_dlg : null,

    files_dlg : null,

    saveas_dlg : null,

    init : function(api) {
        M.tool_behateditor.api = api;
        M.tool_behateditor.stepsdefinitions = new STEP_DEFINITIONS_LIST({});
        M.tool_behateditor.load_steps_definitions(0);
        M.tool_behateditor.load_feature_files(0);
        Y.one('#behateditor_searchform').on('submit', function(e) {e.preventDefault();});
        var searchword = Y.one('#behateditor_searchword');
        searchword.on('change', M.tool_behateditor.refresh_search_results);
        searchword.on('keyup', M.tool_behateditor.refresh_search_results);
        Y.all('#behateditor_featureedit .featureedit .featuretab').on(
            'click', M.tool_behateditor.click_feature_editor_tab);
        Y.one('#behateditor_featureedit .content-editor').delegate(
                'click',
                function(e) {
                    var el = e.currentTarget.ancestor('fieldset');
                    if (el.hasClass('collapsed')) {
                        el.removeClass('collapsed');
                    } else {
                        el.addClass('collapsed');
                    }
                },
                'fieldset legend.ftoggler');
        // Toggle between step source and editor.
        Y.one('#behateditor_featureedit').delegate(
                'click', M.tool_behateditor.click_feature_editor_stepcontrol,
                '.content-editor .step .stepcontrols .stepaction');
        // Add new step before current.
        Y.one('#behateditor_featureedit').delegate(
                'click', M.tool_behateditor.click_feature_editor_addstep,
                '.content-editor .step .stepcontrols .addstep');
        // Delete current step.
        Y.one('#behateditor_featureedit').delegate(
                'click', M.tool_behateditor.click_feature_editor_deletestep,
                '.content-editor .step .stepcontrols .deletestep');
        // Change steptype (Given/When/Then/And).
        Y.one('#behateditor_featureedit').delegate(
                'click', M.tool_behateditor.click_feature_editor_steptype,
                '.content-editor .step .stepeditor .steptype span');
        // Pick the result from step definition search.
        Y.one('#behateditor_searchoutput').delegate(
            'click', M.tool_behateditor.click_searchoutput_step,
            '.step');
        // File actions (files, save).
        Y.all('#behateditor_featureedit .controls input').on(
                'click', M.tool_behateditor.click_file_control, this);
        // Select a file from the files list.
        Y.one('#behateditor_fileslist').delegate(
            'click', M.tool_behateditor.click_file,
            '.file input[type=button]');
    },

    refresh_search_results : function() {
        var searchword = Y.one('#behateditor_searchword'),
                keywords = searchword.get('value');
        M.tool_behateditor.stepsdefinitions.search_definitions(keywords);
    },

    click_feature_editor_tab : function(e) {
        var container = Y.one('#behateditor_featureedit .featureedit'),
                newmode;
        if (e.currentTarget.hasClass('tab-editor')) {
            newmode = 'mode-editor';
        } else if (e.currentTarget.hasClass('tab-source')) {
            newmode = 'mode-source';
        } else {
            return;
        }
        if (container.hasClass(newmode)) {
            console.log('You are already on the tab '+newmode);
            return;
        }
        container.removeClass('mode-editor');
        container.removeClass('mode-source');
        container.addClass('mode-loading');
        if (newmode === 'mode-editor') {
            M.tool_behateditor.convert_from_source_to_editor();
        } else {
            M.tool_behateditor.convert_from_editor_to_source();
        }
        container.removeClass('mode-loading');
        container.addClass(newmode);
    },

    convert_from_source_to_editor : function() {
        var source = Y.one('#behateditor_featuresource').get('value'),
                chunks = source.trim().split(/\n[\t\s]*\n/), i, chunkheader, fieldset, chunkcontents,
                targetdiv = Y.one('#behateditor_featureedit .content .content-editor'),
                nextline, steps;
        targetdiv.setContent('');
        for (i in chunks) {
            fieldset = Y.Node.create('<fieldset class="collapsible"></fieldset>');
            chunkcontents = Y.Node.create('<div class="fcontainer clearfix"></div>');
            if (i > 0) {
                // To create an empty line between chunks on re-parsing.
                chunkcontents.append('<div class="hiddenifjs"><textarea></textarea></div>');
            }
            var lines = chunks[i].replace(/\s+\n/g,"\n").replace(/^\n+/,'').replace('/\n+$/','').split(/\n/);
            if ((lines.length > 0 && lines[0].match(/^  (Background|Scenario):/)) ||
                    (lines.length > 1 && lines[0].match(/^  \@/) && lines[1].match(/^  (Background|Scenario):/))) {
                var jsprefix = '';
                if (lines[0].match(/^  \@/)) {
                    jsprefix = lines.shift();
                    chunkcontents.append('<div class="hiddenifjs"><textarea>'+jsprefix+'</textarea></div>');
                }
                chunkheader = lines.shift();
                chunkcontents.append('<div class="hiddenifjs"><textarea>'+chunkheader+'</textarea></div>');
                if (jsprefix !== '') {
                    chunkheader = '<span class="jsprefix">'+jsprefix.trim()+'</span> ' + chunkheader;
                }
                steps = [];
                while (lines.length > 0) {
                    nextline = lines.shift();
                    if (nextline.match(/^     /) && steps.length > 0) {
                        steps[steps.length-1] += "\n" + nextline;
                    } else {
                        steps.push(nextline);
                    }
                }
                for (j in steps) {
                    chunkcontents.append(M.tool_behateditor.feature_step_node(steps[j]));
                }
                chunkcontents.append(M.tool_behateditor.feature_step_node(null, true));
                fieldset.addClass('featuresteps');
            } else {
                if (i > 0) {
                    chunkheader = 'Unrecognised block';
                    fieldset.addClass('unrecognised');
                } else {
                    chunkheader = 'Header';
                    fieldset.addClass('featureheader');
                }
                fieldset.addClass('collapsed');
                chunkcontents.append('<textarea rows="'+chunks[i].split(/\n/).length+'" cols="60">'+
                        chunks[i].replace('<', '&lt;')+'</textarea>');
            }
            fieldset.append('<legend class="ftoggler">'+chunkheader+'</legend>');
            fieldset.append(chunkcontents);
            targetdiv.append(fieldset);
        }
        targetdiv.all('.step .stepcontrols .stepaction-editor').each(function(el) {
            M.tool_behateditor.click_feature_editor_stepcontrol({currentTarget: el});
        });
    },

    convert_from_editor_to_source : function() {
        var sourcecode = Y.one('#behateditor_featuresource');
        // First convert all steps from editor to source.
        Y.all('#behateditor_featureedit .content .content-editor .step.stepmode-editor').
                each(function(stepel){
            M.tool_behateditor.make_step_definition(stepel);
        });
        // Join all textareas into one source text.
        str = '';
        Y.all('#behateditor_featureedit .content .content-editor textarea').each(function(el) {
            str += el.get('value').replace(/[ \n]+$/, '') + "\n";
        });
        sourcecode.set('value', str);
    },

    get_feature_contents : function() {
        // TODO instead of switching to source tab convert to source if we are in editor mode.
        M.tool_behateditor.click_feature_editor_tab(
                {currentTarget: Y.one('#behateditor_featureedit .featuretabs .tab-source')});
        return Y.one('#behateditor_featureedit .content-source textarea').getContent()
    },

    set_feature_contents : function(text, filepath, featurecanbesaved) {
        M.tool_behateditor.click_feature_editor_tab(
                {currentTarget: Y.one('#behateditor_featureedit .featuretabs .tab-source')});
        Y.one('#behateditor_featureedit .content-source textarea').setContent(text);
        Y.one('#behateditor_featureedit .fileactions .filepath').setContent(filepath);
        Y.one('#behateditor_featureedit .controls input[data-action=save]').
                set('value', filepath ? 'Save' : 'Save as');
        M.tool_behateditor.set_feature_can_be_saved(featurecanbesaved);
    },

    set_feature_can_be_saved : function(featurecanbesaved) {
        // TODO
    },

    make_step_definition : function(stepel) {
        var editornode = stepel.one('.stepeditor'),
                sourcecodenode = stepel.one('.stepsource textarea'),
                hash = editornode.getAttribute('data-hash'),
                stepdef = M.tool_behateditor.stepsdefinitions.get(hash);
        sourcecodenode.set('value', stepdef.convert_from_editor_to_source(editornode));
    },

    parse_step_definition : function(stepel) {
        var src = stepel.one('.stepsource textarea').get('value'),
                stepdef = M.tool_behateditor.stepsdefinitions.find_matching_definition(src),
                editornode = stepel.one('.stepeditor');

        if (stepdef === null) {
            return false;
        }
        stepdef.convert_from_sourcecode_to_editor(src, editornode);
        return true;
    },

    click_feature_editor_steptype : function(e) {
        var steptypeel = e.currentTarget.ancestor('.steptype'),
                newtype = e.currentTarget.getAttribute('data-steptype');
        steptypeel.all('span').removeClass('iscurrent');
        steptypeel.all('span').each(function(el) {
            el.setContent(el.getAttribute('data-steptype').substr(0,1));
        });
        e.currentTarget.setContent(newtype);
        e.currentTarget.addClass('iscurrent');
    },

    click_feature_editor_stepcontrol : function(e) {
        var stepel = e.currentTarget.ancestor('.step'), newclass;
        if (e.currentTarget.hasClass('stepaction-source')) {
            newclass = 'stepmode-source';
        } else if (e.currentTarget.hasClass('stepaction-editor')) {
            newclass = 'stepmode-editor';
        } else {
            return;
        }
        if (stepel.hasClass(newclass)) {
            console.log('The current mode for this step is already '+newclass);
            return;
        }
        if (newclass === 'stepmode-editor') {
            if (!M.tool_behateditor.parse_step_definition(stepel)) {
                newclass = 'stepmode-source stepmode-editor-failed';
            }
        } else {
            M.tool_behateditor.make_step_definition(stepel);
        }
        stepel.removeClass('stepmode-source');
        stepel.removeClass('stepmode-editor');
        stepel.removeClass('stepmode-editor-failed');
        stepel.addClass(newclass);
    },

    click_feature_editor_deletestep : function(e) {
        var node, step = e.currentTarget.ancestor('.step');
        step.remove();
    },

    click_feature_editor_addstep : function(e) {
        var insertbeforestep = e.currentTarget.ancestor('.step');
        // Remove existing temp node.
        Y.all('#behateditor_featureedit .content-editor .tempaddstep').remove();
        var tempnode = Y.Node.create('<div class="tempaddstep"></div>');
        insertbeforestep.get('parentNode').insertBefore(tempnode, insertbeforestep);
        M.tool_behateditor.open_addstep_dialogue();
    },

    open_files_dialogue : function(action) {
        if (!M.tool_behateditor.files_dlg) {
            node = Y.Node.create('<div class="filesdialogue" id=></div>');
            M.tool_behateditor.files_dlg = new M.core.dialogue({
                draggable    : true,
                bodyContent  : Y.one('#behateditor_fileselectform'),
                headerContent: 'Feature files', // TODO dynamic
                width        : '700px',
                height       : '500px',
                modal        : true,
                visible      : false
            });
        }
        M.tool_behateditor.files_dlg.show();
        var listnode = Y.one('#behateditor_fileslist');
        listnode.setContent('');
        for (var i in M.tool_behateditor.featurefiles) {
            listnode.append('<div class="file" data-hash="'+i+'" data-loaded="0"><div>'+
                    M.tool_behateditor.featurefiles[i].filepath.replace('/tests/behat/','/...../').
                    replace(/\/([^\/]*)\.feature/, '/<b>$1</b>.feature')+
                    '<input type="button" data-action="edit" value="Edit">'+
                    '<input type="button" data-action="import" value="Import">'+
                    '<input type="button" data-action="preview" value="Preview"><div>'+
                    '<div class="preview hiddenifjs"><textarea rows="6" cols="80"></textarea></div>'+
                    '</div>');
        }
    },

    save_file : function(contents, filepath, successcallback) {
        var api = M.tool_behateditor.api;
        Y.io(api,{
            method: 'POST',
            on: {
                complete: function(id, o, p) {
                    data = Y.JSON.parse(o.responseText);
                    if (data.error !== undefined) {
                        error = new M.core.alert({
                            title:'Error',
                            message:data.error,
                            lightbox:true});
                        error.show();
                        // TODO error callback
                    } else {
                        if (data.features) {
                            // Refresh features list.
                            M.tool_behateditor.featurefiles = data.features;
                            Y.all('#behateditor_fileslist .file textarea').setContent('');
                            Y.all('#behateditor_fileslist .file[data-loaded=1]').setAttribute('data-loaded', 0);
                        }
                        M.tool_behateditor.set_feature_contents(contents, filepath, false);
                        if (successcallback) {
                            successcallback();
                        }
                    }
                }
            },
            data: {
                action : 'savefile',
                filepath : filepath,
                filecontents : contents
            }
        });
    },

    click_file_control : function(e) {
        var action = e.currentTarget.getAttribute('data-action');
        if (action === 'files') {
            M.tool_behateditor.open_files_dialogue(action);
        } else if (action === 'save') {
            var filepath = Y.one('#behateditor_featureedit .fileactions .filepath').getContent();
            if (filepath) {
                var api = M.tool_behateditor.api,
                        contents = M.tool_behateditor.get_feature_contents();
                M.tool_behateditor.save_file(contents, filepath);
            } else {
                M.tool_behateditor.open_saveas_dialogue();
            }
        }
    },

    open_saveas_dialogue : function() {
        if (!M.tool_behateditor.saveas_dlg) {
            M.tool_behateditor.saveas_dlg = new M.core.dialogue({
                draggable    : true,
                bodyContent  : Y.one('#behateditor_filesaveasform'),
                headerContent: 'Save as',
                width        : '700px',
                height       : '300px',
                modal        : true,
                visible      : false
            });
            Y.one('#behateditor_filesaveasform input[type=button]').on('click',
                function(e) {
                    var component = Y.one('#behateditor_filesaveasform input[name=component]'),
                            filename = Y.one('#behateditor_filesaveasform input[name=filename]'),
                            filepath = component.get('value')+'/tests/behat/'+filename.get('value')+'.feature';
                    M.tool_behateditor.save_file(M.tool_behateditor.get_feature_contents(), filepath,
                        M.tool_behateditor.saveas_dlg.hide);
                });
        }
        M.tool_behateditor.saveas_dlg.show();
        Y.all('#behateditor_filesaveasform input[type=text]').set('value', '');
    },

    click_file : function(e) {
        var action = e.currentTarget.getAttribute('data-action'),
                filenode = e.currentTarget.ancestor('.file'),
                hash = filenode.getAttribute('data-hash'),
                loadstatus = filenode.getAttribute('data-loaded'),
                textarea = filenode.one('textarea'),
                processaction = function(action, text) {
                    if (action === 'edit') {
                        M.tool_behateditor.set_feature_contents(text,
                            M.tool_behateditor.featurefiles[hash].filepath, false);
                        M.tool_behateditor.files_dlg.hide();
                    } else if (action === 'import') {
                        M.tool_behateditor.set_feature_contents(text,
                            '', true);
                        M.tool_behateditor.files_dlg.hide();
                    } else if (action === 'preview') {
                        if (filenode.one('.preview').hasClass('hiddenifjs')) {
                            filenode.one('.preview').removeClass('hiddenifjs');
                        } else {
                            filenode.one('.preview').addClass('hiddenifjs');
                        }
                    }
                };
        if (loadstatus === '0') {
            var api = M.tool_behateditor.api;
            Y.io(api,{
                method: 'GET',
                on: {
                    complete: function(id, o, p) {
                        data = Y.JSON.parse(o.responseText);
                        filenode.setAttribute('loaded', '1');
                        textarea.setContent(data.filecontents);
                        processaction(action, data.filecontents);
                    }
                },
                data: {
                    action : 'filecontents',
                    filepath : M.tool_behateditor.featurefiles[hash].filepath
                }
            });
        } else {
            processaction(action, textarea.getContent());
        }
    },

    open_addstep_dialogue : function() {
        if (!M.tool_behateditor.search_dlg) {
            M.tool_behateditor.search_dlg = new M.core.dialogue({
                draggable    : true,
                bodyContent  : Y.one('#behateditor_searchform'),
                headerContent: 'Search step definition',
                width        : '700px',
                height       : '300px',
                modal        : true,
                visible      : false
            });
            /* M.tool_behateditor.search_dlg.after("visibleChange", function(e) {
                var panel = M.tool_behateditor.search_dlg;
                if (!panel.get('visible')) {
                    // This does not work because it gets removed too early.
                    Y.all('#behateditor_featureedit .content-editor .tempaddstep').remove();
                }
            }); */
        }
        M.tool_behateditor.search_dlg.show();
        M.tool_behateditor.search_dlg.align('#behateditor_featureedit .content-editor .tempaddstep',
            [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.BL]);
        Y.one('#behateditor_searchword').focus();
        Y.one('#behateditor_searchword').select();
    },

    close_addstep_dialogue : function(hash) {
        var tempnode = Y.one('#behateditor_featureedit .content-editor .tempaddstep');
        if (M.tool_behateditor.search_dlg) {
            M.tool_behateditor.search_dlg.hide();
        }
        if (tempnode === null) {
            console.log('Add step target is lost');
            return;
        }
        if (M.tool_behateditor.stepsdefinitions.get(hash)) {
            var src = M.tool_behateditor.stepsdefinitions.get(hash).get_new_step_text();
            var node = M.tool_behateditor.feature_step_node(src);
            tempnode.get('parentNode').insertBefore(node, tempnode);
            M.tool_behateditor.click_feature_editor_stepcontrol({currentTarget: node.one('.stepcontrols .stepaction-editor')});
            M.tool_behateditor.mark_node_as_just_added(node);
        }
        tempnode.remove();
    },

    mark_node_as_just_added : function(node) {
        var nodeid = node.generateID();
        node.addClass('justadded');
        // Remove highlighting after 5 seconds.
        Y.later(5000,this,function(id){Y.all('#'+id).removeClass('justadded');},[nodeid]);
    },

    click_searchoutput_step : function(e) {
        var hash = e.currentTarget.getAttribute('data-hash').replace(/"/g,'');
        M.tool_behateditor.close_addstep_dialogue(hash);
    },

    feature_step_node : function(src, lastnode) {
        var node;
        if (lastnode) {
            node = Y.Node.create('<div class="step laststep clearfix"></div>');
            node.append('<div class="stepcontrols">'+
                    '<span class="addstep">Add</span>'+
                    '</div>');
        } else {
            node = Y.Node.create('<div class="step stepmode-source clearfix"></div>');
            node.append('<div class="stepcontrols">'+
                    '<span class="addstep">Add</span>'+
                    '<span class="deletestep">Del</span>'+
                    '<span class="stepaction stepaction-editor">Edit</span>'+
                    '<span class="stepaction stepaction-source">Src</span>'+
                    '</div>');
            node.append('<div class="stepsource"><textarea rows="'+src.split(/\n/).length+
                        '" cols="60">'+src+'</textarea></div>');
            node.append('<div class="stepeditor"></div>');
        }
        return node;
    },

    display_search_results : function(hashes) {
        var i, container = Y.one('#behateditor_searchoutput');
        container.setContent('');
        container.addClass('empty');
        for (i in hashes) {
            container.append(M.tool_behateditor.stepsdefinitions.get(hashes[i]).display_in_search_results());
            container.removeClass('empty');
        }
    },

    load_steps_definitions : function(force) {
        var api = M.tool_behateditor.api;
        Y.io(api,{
            method: 'GET',
            on: {
                complete: function(id, o, p) {
                    data = Y.JSON.parse(o.responseText);
                    M.tool_behateditor.stepsdefinitions =
                            new STEP_DEFINITIONS_LIST(data.stepsdefinitions);
                    M.tool_behateditor.textselectors = data.textselectors;
                    M.tool_behateditor.selectors = data.selectors;
                    M.tool_behateditor.refresh_search_results();
                }
            },
            data: {
                action : 'stepsdef',
                force : force
            }
        });
    },

    load_feature_files : function(force) {
        var api = M.tool_behateditor.api;
        Y.io(api,{
            method: 'GET',
            on: {
                complete: function(id, o, p) {
                    data = Y.JSON.parse(o.responseText);
                    M.tool_behateditor.featurefiles = data.features;
                    Y.all('#behateditor_featureedit .fileactions .controls.hiddenifjs').removeClass('hiddenifjs');
                }
            },
            data: {
                action : 'features',
                force : force
            }
        });
    },

    /**
     * Trying to determine the argument type by it's name.
     */
    get_type_from_param : function(param) {
        var trimmedparam = param.replace(/^"/, '').replace(/"$/, '');
        if (trimmedparam.match(/^SELECTOR\d?_STRING$/)) {
            return 'SELECTOR_STRING';
        } else if (trimmedparam.match(/^TEXT_SELECTOR\d?_STRING$/)) {
            return 'TEXT_SELECTOR_STRING';
        } else if (trimmedparam.match(/_STRING$/)) {
            return 'STRING';
        } else if (trimmedparam.match(/_NUMBER$/)) {
            return 'NUMBER';
        }
        return 'UNKNOWN';
    },

    /**
     * Trying to determine the argument regex by it's name.
     */
    get_regex_from_param : function(param) {
        var paramtype = M.tool_behateditor.get_type_from_param(param),
                regex = '((?:[^"]|\\\\")*)';
        if (paramtype === 'SELECTOR_STRING') {
            regex = '('+M.tool_behateditor.selectors.join('|')+')';
        } else if (paramtype === 'TEXT_SELECTOR_STRING') {
            regex = '('+M.tool_behateditor.textselectors.join('|')+')';
        } else if (paramtype === 'NUMBER') {
            regex = '([\\d]+)';
        }
        return regex;
    },

    /**
     * Returns the default value for param that actually matches get_regex_from_param.
     */
    get_defaultvalue_from_param : function(param) {
        var paramtype = M.tool_behateditor.get_type_from_param(param);
        if (paramtype === 'SELECTOR_STRING') {
            return M.tool_behateditor.selectors[0];
        } else if (paramtype === 'TEXT_SELECTOR_STRING') {
            return M.tool_behateditor.textselectors[0];
        } else if (paramtype === 'NUMBER') {
            return 1;
        }
        var regex = M.tool_behateditor.get_regex_from_param(param);
        if (param.match(new RegExp('^'+regex+'$',''))) {
            return param;
        }
        return '';
    }
};

/**
 * Returns object representing list of step definitions.
 *
 * @param String hash
 * @param Array data
 * @returns Object
 */
/**
 * Properties and methods of one step definition
 */
var STEP_DEFINITIONS_LIST = function() {
    STEP_DEFINITIONS_LIST.superclass.constructor.apply(this, arguments);
};

STEP_DEFINITIONS_LIST.prototype = {
    list : {},
    keywords : [],
    hashes : [],
    /**
     * Called during the initialisation process of the object.
     * @method initializer
     */
    initializer : function(stepsdefinitions) {
        for (var hash in stepsdefinitions) {
            stepsdefinitions[hash]['hash'] = hash;
            this.list[hash] = new STEP_DEFINITION(stepsdefinitions[hash]);
            this.keywords = this.keywords.concat(this.list[hash].keywords)
            this.hashes.push(hash);
        }
        this.keywords = Y.Array.unique(this.keywords);
    },
    get : function(hash) {
        return this.list[hash];
    },
    _get_matching_keywords : function(searchstring) {
        var words = searchstring.trim().split(/ +/), keywords = [];
        Y.Array.each(words, function(w) {
            var wordkeywords = Y.Array.filter(this.keywords, function(k){return k.substring(0, w.length) === w;});
            keywords.push(wordkeywords);
        }, this);
        return keywords;
    },
    /** Seach definitions matching keywords (still server side). */
    search_definitions : function(searchstring) {
        searchstring = searchstring.replace(/[\.,!\?;:\-\+\'"\\/\(\)\#|]/g,' ').trim()
        var hashes = this.hashes;
        if (searchstring.length) {
            var allkeywords = this._get_matching_keywords(searchstring);
            while (allkeywords.length && hashes.length) {
                var wordkeywords = allkeywords.shift();
                hashes = Y.Array.filter(hashes, function(h) {return this.get(h).has_any_keyword(wordkeywords);}, this);
            }
        }
        M.tool_behateditor.display_search_results(hashes);
    },
    /** Being given a string step tries to find a matching definition */
    find_matching_definition : function(text) {
        var hash = null, i,
                lines = text.replace(/[\s\n]+$/,'').replace(/^\n+/,'').split(/\n/)
        if (!lines.length) {
            console.log('Can not parse empty step');
            return null;
        }
        if (lines.length > 1) {
            console.log('Can not parse multiline step (TODO)');
            return null;
            // TODO tables!
        }
        if (!lines[0].match(/^ *(And|Given|Then|When) /)) {
            console.log('Can not parse step: first word must be And|Given|Then|When');
            return null;
        }
        for (i in this.list) {
            if (this.list[i].match_step(text) !== null) {
                if (hash === null) {
                    hash = i;
                } else {
                    console.log('Can not parse step: More than one definition match');
                    return null;
                }
            }
        }
        if (hash === null) {
            console.log('Can not parse step: No matching definition found');
            return null;
        }
        return this.list[hash];
    }
};

Y.extend(STEP_DEFINITIONS_LIST, Y.Base, STEP_DEFINITIONS_LIST.prototype, {
    NAME : 'moodle-tool_behateditor-stepdefinitionslist',
});

/**
 * Properties and methods of one step definition
 */
var STEP_DEFINITION = function() {
    STEP_DEFINITION.superclass.constructor.apply(this, arguments);
};

STEP_DEFINITION.prototype = {
    hash : null,
    stepregex : null,
    steptype : null,
    stepdescription : null,
    keywords : [],
    /**
     * Called during the initialisation process of the object.
     * @method initializer
     */
    initializer : function(data) {
        this.hash = data['hash'];
        this.stepregex = data['stepregex'];
        this.steptype = data['steptype'];
        this.stepdescription = data['stepdescription'];
        this.keywords = data['keywords'];
    },
    /**
     * Returns HTML to display the definition in the search resutls.
     * @returns {Node}
     */
    display_in_search_results : function() {
        return Y.Node.create('<div class="step" data-hash="'+this.hash+
            '"><div class="stepdescription">'+this.stepdescription+
            '</div><div class="stepcontent"><span class="steptype">'+this.steptype+
            ' </span><span class="stepregex">'+this.stepregex+'</span></div></div>');
    },
    has_any_keyword : function(keywords) {
        for (var k in keywords) {
            if (Y.Array.indexOf(this.keywords, keywords[k]) >= 0) {
                return true;
            }
        }
        return false;
    },
    /**
     * Matches the real step wording to the current definition and returns array of matches or false if matching failed.
     * First element in the returned array is a steptype (Given|When|Then|And), others are step parameters.
     *
     * @param {String} str
     * @returns {Array}|false
     */
    match_step : function(str) {
        var lines = str.replace(/[\s\n]+$/,'').replace(/^\n+/,'').split(/\n/);
        var firstline = lines[0].trim();
        var regex = this.stepregex;
        regex = '^(Given|When|Then|And) '+regex.replace(/"([A-Z][A-Z|0-9|_]*)"/g,
                function(str,match) { return '"'+M.tool_behateditor.get_regex_from_param(match)+'"'; })+'$';
        try {
            var matches = firstline.match(new RegExp(regex, ''));
            if (matches !== null) {
                matches.shift(); // First element is the whole string, we don't need it.
            }
            return matches;
        } catch(e) {
            return null;
        }
    },
    get_new_step_text : function() {
        return '    ' + this.steptype + ' ' +
                this.stepregex.replace(/"([A-Z][A-Z|0-9|_]*)"/g,
                function(str,match) { return '"'+M.tool_behateditor.get_defaultvalue_from_param(match)+'"'; });
        // TODO multiline
    },
    /**
     * Converts from editor to sourcecode
     *
     * @param {Node} editornode
     * @returns {String}
     */
    convert_from_editor_to_source : function(editornode) {
        var str = this.stepregex,
                steptype = editornode.one('.steptype .iscurrent').getAttribute('data-steptype');
        str = str.replace(/"([A-Z][A-Z|0-9|_]*)"/g, function(fullstring) {
            return '"' + editornode.one('.stepregex').
                    one('span[data-param='+fullstring+'] input,span[data-param='+fullstring+'] select').get('value') + '"';
        });
        return '    '+steptype+' '+str;
    },
    /**
     * Converts from sourcecode to editor
     * @param {String} src
     * @returns {Node}
     */
    convert_from_sourcecode_to_editor : function(src, editornode) {
        var steptext = this.stepregex.replace(/"([A-Z][A-Z|0-9|_]*)"/g,
            function(fullstring, param) {
                return '"<span data-param="'+param+'" data-type="'+
                        M.tool_behateditor.get_type_from_param(param)+
                        '"></span>"';
            });

        // CREATE HTML for steptype.
        var steptypenode = Y.Node.create('<span class="steptype"></span>');
        Y.Array.each(['Given', 'When', 'Then', 'And'],
            function(n) {steptypenode.append('<span data-steptype="'+n+'"></span>');});

        // CREATE HTML for stepregex.
        var stepregexnode = Y.Node.create('<span class="stepregex"></span>');
        stepregexnode.append(steptext);
        stepregexnode.all('span[data-type="SELECTOR_STRING"]').each(function(el){
            el.append('<select size="1"></select>');
            Y.Array.each(M.tool_behateditor.selectors, function(o){
                el.one('select').append('<option value="'+o+'">'+o+'</option>');
            });
        });
        stepregexnode.all('span[data-type="TEXT_SELECTOR_STRING"]').each(function(el){
            el.append('<select size="1"></select>');
            Y.Array.each(M.tool_behateditor.textselectors, function(o){
                el.one('select').append('<option value="'+o+'">'+o+'</option>');
            });
        });
        stepregexnode.all('span[data-type="NUMBER"]').each(function(el){
            el.append('<input type="text" size="5" />');
        });
        stepregexnode.all('span[data-type="STRING"],span[data-type="UNKNOWN"]').each(function(el){
            el.append('<input type="text" size="20" />');
        });

        // ADD HTML to editornode.
        editornode.setContent('');
        editornode.setAttribute('data-hash', this.hash);
        editornode.append(steptypenode);
        editornode.append(stepregexnode);

        // SET THE VALUES.
        var values = this.match_step(src);
        var steptype = values.shift();

        M.tool_behateditor.click_feature_editor_steptype({currentTarget: steptypenode.one('[data-steptype='+steptype+']')});
        stepregexnode.all('span').each(function(el){
            el.one('select,input').set('value', values.shift());
        });

        return editornode;
    }
};

Y.extend(STEP_DEFINITION, Y.Base, STEP_DEFINITION.prototype, {
    NAME : 'moodle-tool_behateditor-stepdefinition'
});

}, '@VERSION@', { requires: ['base', 'io-base', 'node', 'node-data', 'array-extras', 'json-parse', 'overlay', 'moodle-core-notification'] });