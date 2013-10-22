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
        // Do not auto-submit the search form.
        Y.one('#behateditor_searchform').on('submit', function(e) {e.preventDefault();});
        var searchword = Y.one('#behateditor_searchword');
        searchword.on('valuechange', M.tool_behateditor.refresh_search_results);
        // Click on Tab switching between editing and source modes.
        Y.all('#behateditor_featureedit .featuretab').on(
            'click', M.tool_behateditor.click_feature_editor_tab);
        // Expand/collapse fieldsets.
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
        Y.one('#behateditor_searchoutput').delegate(
            'dblclick', M.tool_behateditor.select_searchoutput_step,
            '.step');
        // File actions (files, save).
        Y.all('#behateditor_featureedit .controls input').on(
                'click', M.tool_behateditor.click_file_control, this);
        // Select a file from the files list.
        Y.one('#behateditor_fileslist').delegate(
            'click', M.tool_behateditor.click_file,
            '.file input[type=button]');
        // Resize to fullscreen
        M.tool_behateditor.resize_window();
        Y.on('windowresize', function(e) {M.tool_behateditor.resize_window();});
        // Track form changes
        Y.one('#behateditor_featureedit').delegate('valuechange',
            function(){M.tool_behateditor.set_feature_can_be_saved(true);},
            'input,textarea,select');
        M.tool_behateditor.set_feature_contents('', null, false);
    },

    resize_window : function() {
        var container = Y.one('#behateditor_featureedit .featureedit .content.iscurrent');
        var newheight = Y.DOM.winHeight();
        container.setStyle('height', newheight);
        var delta = Y.DOM.docHeight() - Y.DOM.winHeight();
        newheight = newheight - delta;
        if (newheight < 300) {
            newheight = 300;
        }
        container.setStyle('height', newheight);
    },

    add_status_message : function(msgtext, msgclass, timeout) {
        var node = Y.Node.create('<div></div>');
        nodeid = node.generateID();
        if (!msgclass) {
            msgclass = 'notification';
        }
        node.addClass('msg'+msgclass);
        node.setContent(msgtext);
        Y.one('#behateditor_messages').append(node);
        if (!timeout) {
            // Default timeout 10s.
            timeout = 10000;
        }
        Y.later(timeout, this, function(id){Y.all('#'+id).remove();}, [nodeid]);
        return nodeid;
    },

    refresh_search_results : function() {
        var searchword = Y.one('#behateditor_searchword'),
                keywords = searchword.get('value');
        M.tool_behateditor.stepsdefinitions.search_definitions(keywords);
    },

    click_feature_editor_tab : function(e) {
        var container = Y.one('#behateditor_featureedit .featureedit'),
                newmode = e.currentTarget.getAttribute('data-mode'),
                curmode = container.getAttribute('data-mode');
        if (curmode === newmode) {
            //console.log('You are already on the tab '+
            //    container.one('.featuretab[data-mode="'+curmode+'"]').get('value'));
            return;
        }
        container.all('.featuretab[data-mode="'+curmode+'"],.content[data-mode="'+curmode+'"]').removeClass('iscurrent');
        container.setAttribute('data-mode', newmode);
        if (newmode === 'editor') {
            M.tool_behateditor.convert_from_source_to_editor();
        } else {
            M.tool_behateditor.convert_from_editor_to_source();
        }
        container.all('.featuretab[data-mode="'+newmode+'"],.content[data-mode="'+newmode+'"]').addClass('iscurrent');
        M.tool_behateditor.resize_window();
    },

    convert_from_source_to_editor : function() {
        var source = Y.one('#behateditor_featuresource').get('value'),
                chunks = source.trim().split(/\n[\t\s]*\n/), i, chunkheader, fieldset, chunkcontents,
                targetdiv = Y.one('#behateditor_featureedit .content-editor'),
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
            if ((lines.length > 0 && lines[0].match(/^ *(Background|Scenario|Scenario Outline|Examples):/)) ||
                    (lines.length > 1 && lines[0].match(/^  \@/) && lines[1].match(/^ *(Background|Scenario|Scenario Outline):/))) {
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
        Y.all('#behateditor_featureedit .content-editor .step.stepmode-editor').
                each(function(stepel){
            M.tool_behateditor.make_step_definition(stepel);
        });
        // Join all textareas into one source text.
        str = '';
        Y.all('#behateditor_featureedit .content-editor textarea').each(function(el) {
            str += el.get('value').replace(/[ \n]+$/, '') + "\n";
        });
        sourcecode.set('value', str);
    },

    get_feature_contents : function() {
        if (Y.one('#behateditor_featureedit .featureedit').getAttribute('data-mode') === 'editor') {
            M.tool_behateditor.convert_from_editor_to_source();
        }
        return Y.one('#behateditor_featuresource').get('value')
    },

    set_feature_contents : function(text, filepath, featurecanbesaved) {
        Y.one('#behateditor_featuresource').set('value', text);
        Y.one('#behateditor_featureedit .fileactions .filepath').setContent(filepath);
        Y.one('#behateditor_featureedit .controls input[data-action="save"]').
                set('value', filepath ? 'Save' : 'Save as');
        if (Y.one('#behateditor_featureedit .featureedit').getAttribute('data-mode') === 'editor') {
            M.tool_behateditor.convert_from_source_to_editor();
        }
        M.tool_behateditor.set_feature_can_be_saved(featurecanbesaved);
    },

    set_feature_can_be_saved : function(featurecanbesaved) {
        var element = Y.one('#behateditor_featureedit .controls input[data-action="save"]');
        if (featurecanbesaved) {
            element.removeClass('hiddenifjs');
        } else {
            element.addClass('hiddenifjs');
        }
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
            //console.log('The current mode for this step is already '+newclass);
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
        M.tool_behateditor.add_status_message('Step deleted', 'notification');
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
                    if (M.tool_behateditor.process_request_result(id, o, p)) {
                        M.tool_behateditor.set_feature_contents(contents, filepath, false);
                        M.tool_behateditor.add_status_message('File saved', 'notification')
                        if (successcallback) {
                            successcallback();
                        }
                    } else {
                        M.tool_behateditor.add_status_message('File is NOT saved', 'error')
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
                        function(){M.tool_behateditor.saveas_dlg.hide();});
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
                processaction = function(hash, action) {
                    var filenode = Y.one('#behateditor_fileslist .file[data-hash="'+hash+'"]'),
                            text = filenode.one('textarea').get('value')
                    if (action === 'edit') {
                        M.tool_behateditor.set_feature_contents(text,
                            M.tool_behateditor.featurefiles[hash].filepath, false);
                        M.tool_behateditor.files_dlg.hide();
                    } else if (action === 'import') {
                        M.tool_behateditor.set_feature_contents(text, '', true);
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
                        if (M.tool_behateditor.process_request_result(id, o, p)) {
                            var data = Y.JSON.parse(o.responseText);
                            for (hash in data.filecontents) {
                                processaction(hash, action);
                            }
                        }
                    }
                },
                data: {
                    action : 'filecontents',
                    filehash : hash
                }
            });
        } else {
            processaction(hash, action);
        }
    },

    open_addstep_dialogue : function() {
        if (!M.tool_behateditor.search_dlg) {
            M.tool_behateditor.search_dlg = new M.core.dialogue({
                draggable    : true,
                bodyContent  : Y.one('#behateditor_searchform'),
                headerContent: 'Search step definition',
                width        : '900px',
                height       : '500px',
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
        //M.tool_behateditor.search_dlg.align('#behateditor_featureedit .content-editor .tempaddstep',
        //    [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.BL]);
        Y.one('#behateditor_searchword').focus();
        Y.one('#behateditor_searchword').select();
        // deselect step definitions from the last search
        Y.all('#behateditor_searchoutput .step.isselected').removeClass('isselected');
        Y.one('#behateditor_searchdetails').addClass('hiddenifjs');
        var msgnodeid = M.tool_behateditor.add_status_message('Double click step definition to add it', 'notification', 180000);
        M.tool_behateditor.search_dlg.after("visibleChange", function(e) {
            if (!M.tool_behateditor.search_dlg.get('visible')) {
                Y.all('#'+msgnodeid).remove(msgnodeid);
            }
        });
    },

    close_addstep_dialogue : function(hash) {
        var tempnode = Y.one('#behateditor_featureedit .content-editor .tempaddstep');
        if (M.tool_behateditor.search_dlg) {
            M.tool_behateditor.search_dlg.hide();
        }
        if (tempnode === null) {
            M.tool_behateditor.add_status_message('Add step target is lost', 'error');
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
        M.tool_behateditor.add_status_message('Step added', 'notification', 5000);
    },

    click_searchoutput_step : function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
        M.tool_behateditor.stepsdefinitions.get(hash).display_in_search_details();
    },

    select_searchoutput_step : function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
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
            node.append('<div class="stepsource"><textarea rows="1" cols="60"></textarea></div>');
            node.append('<div class="stepeditor"></div>');
            node.one('.stepsource textarea').set('value', src);
            node.one('.stepsource textarea').set('rows', src.split(/\n/).length);
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

    process_request_result : function(id, o, p) {
        var data = Y.JSON.parse(o.responseText);
        if (data.error) {
            error = new M.core.alert({
                title:'Error',
                message:data.error,
                lightbox:true});
            error.show();
            return false;
        } else {
            if (data.stepsdefinitions) {
                M.tool_behateditor.stepsdefinitions =
                        new STEP_DEFINITIONS_LIST(data.stepsdefinitions);
                M.tool_behateditor.refresh_search_results();
            }
            if (data.textselectors) {
                M.tool_behateditor.textselectors = data.textselectors;
            }
            if (data.selectors) {
                M.tool_behateditor.selectors = data.selectors;
            }
            if (data.features) {
                M.tool_behateditor.featurefiles = data.features;
                Y.all('#behateditor_featureedit .fileactions .controls.hiddenifjs').removeClass('hiddenifjs');
                Y.all('#behateditor_fileslist .file textarea').set('value', '');
                Y.all('#behateditor_fileslist .file[data-loaded="1"]').setAttribute('data-loaded', 0);
            }
            if (data.filecontents) {
                for (var hash in data.filecontents) {
                    var filenode1 = Y.one('#behateditor_fileslist .file[data-hash="'+hash+'"]');
                    filenode1.setAttribute('data-loaded', '1');
                    filenode1.one('textarea').set('value', data.filecontents[hash]);
                }
            }
            return true;
        }
    },

    load_steps_definitions : function(force) {
        var api = M.tool_behateditor.api,
            msgnodeid = M.tool_behateditor.add_status_message('Loading step definitions...', 'notification', 180000);
        Y.io(api,{
            method: 'GET',
            on: {
                complete: function(id, o, p) {
                    if (M.tool_behateditor.process_request_result(id, o, p)) {
                        Y.all('#'+msgnodeid).remove(p.msgnodeid);
                        M.tool_behateditor.add_status_message('Successfully loaded step definitions', 'notification');
                    }
                }
            },
            data: {
                action : 'stepsdef',
                force : force
            },
            arguments: {
                msgnodeid : msgnodeid
            }
        });
    },

    load_feature_files : function(force) {
        var api = M.tool_behateditor.api,
            msgnodeid = M.tool_behateditor.add_status_message('Loading feature files list...', 'notification', 180000);
        Y.io(api,{
            method: 'GET',
            on: {
                complete: function(id, o, p) {
                    if (M.tool_behateditor.process_request_result(id, o, p)) {
                        Y.all('#'+p.msgnodeid).remove();
                        M.tool_behateditor.add_status_message('Successfully loaded feature files list', 'notification');
                    }
                }
            },
            data: {
                action : 'features',
                force : force
            },
            arguments: {
                msgnodeid : msgnodeid
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
        searchstring = searchstring.replace(/[\.,!\?;:\-\+\'"\\/\(\)\#|]/g,' ').toLowerCase().trim()
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
            M.tool_behateditor.add_status_message('Can not parse empty step', 'warning');
            return null;
        }
        if (lines.length > 1) {
            M.tool_behateditor.add_status_message('Can not parse multiline step (yet)<br><span="stepregex">'+
                    lines[0]+'</span>', 'notification', 2000);
            return null;
            // TODO tables!
        }
        if (!lines[0].match(/^ *(And|Given|Then|When) /)) {
            M.tool_behateditor.add_status_message('Can not parse step: first word must be And|Given|Then|When<br><span="stepregex">'+
                    lines[0]+'</span>', 'warning');
            return null;
        }
        for (i in this.list) {
            if (this.list[i].match_step(text) !== null) {
                if (hash === null) {
                    hash = i;
                } else {
                    M.tool_behateditor.add_status_message('Can not parse step: More than one definition match<br><span="stepregex">'+
                    lines[0]+'</span>', 'warning');
                    return null;
                }
            }
        }
        if (hash === null) {
            M.tool_behateditor.add_status_message('Can not parse step: No matching definition found<br><span="stepregex">'+
                    lines[0]+'</span>', 'warning');
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
    steptype : null,
    stepdescription : null,
    keywords : [],
    component : null,
    functionname : null,
    path : null,
    lines : null,
    fullregex : null,
    steptext : null,
    //params : null,
    multiline : false,
    /**
     * Called during the initialisation process of the object.
     * @method initializer
     */
    initializer : function(data) {
        for (var key in data) {
            this[key] = data[key];
        }
        this.steptext = this.steptext.replace(/^\//,'').replace(/\/$/,'');
        var node = Y.Node.create('<div></div>');
        node.setContent(this.steptext);
        node.all('span').each(function(el){
            el.get('parentNode').insertBefore('('+el.getAttribute('data-regex')+')', el);
            el.remove();
        });
        this.fullregex = new RegExp(node.getContent(), '');
        this.steptext = this.steptext.replace(/^\^/,'').replace(/\$$/,'');
        //console.log(this.fullregex)
    },
    /**
     * Returns HTML to display the definition in the search resutls.
     * @returns {Node}
     */
    display_in_search_results : function() {
        var node = Y.Node.create('<div class="step" data-hash="'+this.hash+
            '"><div class="stepcomponent">'+this.component.replace(/^behat_/,'')+
            '</div><div class="stepcontent"><span class="steptype">'+this.steptype+
            ' </span><span class="stepregex">'+this.steptext+'</span></div></div>');
        node.all('.stepregex span').each(function(el){
            el.setContent(el.getAttribute('data-name'));
        });
        return node;
    },
    display_in_search_details : function() {
        var node = Y.one('#behateditor_searchdetails .step');
        Y.all('#behateditor_searchoutput .step.isselected').removeClass('isselected');
        Y.all('#behateditor_searchdetails').removeClass('hiddenifjs');
        Y.all('#behateditor_searchoutput .step[data-hash="'+this.hash+'"]').addClass('isselected');
        node.setAttribute('data-hash', this.hash);
        node.one('.stepcomponent').setContent(this.component.replace(/^behat_/,''));
        node.one('.stepdescription').setContent(this.stepdescription);
        node.one('.steptype').setContent(this.steptype);
        node.one('.stepregex').setContent(this.steptext);
        node.all('.stepregex span').each(function(el){
            el.setContent(el.getAttribute('data-name'));
        });
        node.one('.stepfunctionname').setContent(this.functionname+'()');
        node.one('.steppath').setContent(this.path);
        node.one('.steppath').set('href', 'https://github.com/moodle/moodle/blob/master/'+this.path+'#L'+this.lines[0]+'-'+this.lines[1]);
        return node;
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
        var lines = str.replace(/[\s\n]+$/,'').replace(/^\n+/,'').split(/\n/),
                firstwordarray = lines[0].trim().match(/^(\w+) /),
                firstword = firstwordarray[1],
                firstline = lines[0].trim().replace(/^(Given|When|Then|And) /,'');
        try {
            var matches = firstline.match(this.fullregex);
            if (matches !== null) {
                //matches.shift(); // First element is the whole string, we don't need it.
                matches[0] = firstword; // TODO not nice
            }
            return matches;
        } catch(e) {
            return null;
        }
    },
    get_new_step_text : function() {
        var tmp = Y.Node.create('<div></div>');
        tmp.setContent(this.steptext);
        tmp.all('span').each(function(el){
            el.get('parentNode').insertBefore(el.getAttribute('data-default'), el);
            el.remove();
        });
        return '    ' + this.steptype + ' ' + tmp.getContent();
    },
    /**
     * Converts from editor to sourcecode
     *
     * @param {Node} editornode
     * @returns {String}
     */
    convert_from_editor_to_source : function(editornode) {
        // TODO!
        var steptype = editornode.one('.steptype .iscurrent').getAttribute('data-steptype'),
                node = Y.Node.create('<div></div>');
        node.append(this.steptext);
        node.all('span').each(function(el){
            var name = el.getAttribute('data-name');
            var value = editornode.one('.stepregex span[data-name="'+name+'"] input,span[data-name="'+name+'"] select').get('value');
            el.get('parentNode').insertBefore(value, el);
            el.remove();
        });
        return '    '+steptype+' '+node.getContent();
    },
    /**
     * Converts from sourcecode to editor
     * @param {String} src
     * @returns {Node}
     */
    convert_from_sourcecode_to_editor : function(src, editornode) {
        // CREATE HTML for steptype.
        var steptypenode = Y.Node.create('<span class="steptype"></span>');
        Y.Array.each(['Given', 'When', 'Then', 'And'],
            function(n) {steptypenode.append('<span data-steptype="'+n+'"></span>');});

        // CREATE HTML for stepregex.
        var stepregexnode = Y.Node.create('<span class="stepregex"></span>');
        stepregexnode.append(this.steptext);
        stepregexnode.all('span[data-type="SELECT"]').each(function(el){
            el.append('<select size="1"></select>');
            //console.log(el.getAttribute('data-options').split(','));
            Y.Array.each(el.getAttribute('data-options').split(','), function(o){
                el.one('select').append('<option value="'+o+'">'+o+'</option>');
            });
        });
        stepregexnode.all('span[data-type="NUMBER"]').each(function(el){
            el.append('<input type="text" size="5" />');
        });
        stepregexnode.all('span[data-type="STRING"]').each(function(el){
            el.append('<input type="text" size="20" />');
        });
        stepregexnode.all('span[data-type="TableNode"]').each(function(el){
            // TODO tables
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

        M.tool_behateditor.click_feature_editor_steptype({currentTarget: steptypenode.one('[data-steptype="'+steptype+'"]')});
        stepregexnode.all('span').each(function(el){
            el.one('select,input').set('value', values.shift());
        });
        // stepregexnode.all('select,input').set('value', values.shift()); // TODO easier?

        return editornode;
    }
};

Y.extend(STEP_DEFINITION, Y.Base, STEP_DEFINITION.prototype, {
    NAME : 'moodle-tool_behateditor-stepdefinition'
});

}, '@VERSION@', { requires: ['base', 'io-base', 'node', 'node-data', 'array-extras', 'event-valuechange', 'event-resize', 'json-parse', 'overlay', 'moodle-core-notification'] });