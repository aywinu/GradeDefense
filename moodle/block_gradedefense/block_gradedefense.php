<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

class block_gradedefense extends block_base {
    
    public function init() {
        $this->title = get_string('pluginname', 'block_gradedefense');
    }
    
    public function applicable_formats() {
        return array(
            'my' => true,
            'course-view' => true
        );
    }
    
    public function get_content() {
        global $USER, $PAGE;
        
        if ($this->content !== null) {
            return $this->content;
        }
        
        $this->content = new stdClass();
        $this->content->text = '';
        $this->content->footer = '';
        
        // Get the configured game URL
        $gameurl = get_config('block_gradedefense', 'gameurl');
        if (empty($gameurl)) {
            $gameurl = 'https://aywinu.github.io/GradeDefense/';
        }
        
        // Collect upcoming action events for the next 70 days
        $now = time();
        $endtime = $now + (70 * 86400); // 70 days from now
        
        $events = array();
        
        // Try modern API first (Moodle 3.4+)
        if (class_exists('\core_calendar\local\api')) {
            try {
                $actionevents = \core_calendar\local\api::get_action_events_by_timesort($USER->id, $now, $endtime);
                
                foreach ($actionevents as $event) {
                    // Get course information
                    $courseid = isset($event->courseid) ? $event->courseid : 0;
                    $courseshortname = '';
                    $coursefullname = '';
                    
                    if ($courseid > 0) {
                        $course = get_course($courseid);
                        $courseshortname = format_string($course->shortname, true, array('context' => context_course::instance($courseid)));
                        $coursefullname = format_string($course->fullname, true, array('context' => context_course::instance($courseid)));
                    }
                    
                    // Infer type from module name and event name
                    $modulename = isset($event->modulename) ? $event->modulename : '';
                    $eventname = isset($event->name) ? $event->name : '';
                    $type = $this->infer_event_type($modulename, $eventname);
                    
                    // Get points (grade max) if available
                    $points = null;
                    if ($courseid > 0 && !empty($event->instance)) {
                        $points = $this->get_grade_max($courseid, $modulename, $event->instance);
                    }
                    
                    // Build event data
                    $eventdata = array(
                        'id' => isset($event->id) ? $event->id : 0,
                        'courseId' => $courseshortname,
                        'courseTitle' => $coursefullname,
                        'name' => format_string($eventname, true),
                        'dueDate' => isset($event->timestart) ? date('c', $event->timestart) : date('c', $now),
                        'type' => $type,
                        'points' => $points
                    );
                    
                    $events[] = $eventdata;
                }
            } catch (Exception $e) {
                // Fall back to empty events array
                debugging('Grade Defense block: Failed to fetch calendar events - ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
        } else {
            // Fallback for older Moodle versions
            // Use calendar_get_legacy_events if available
            if (function_exists('calendar_get_legacy_events')) {
                $legacyevents = calendar_get_legacy_events($now, $endtime, $USER->id);
                
                foreach ($legacyevents as $event) {
                    $courseid = isset($event->courseid) ? $event->courseid : 0;
                    $courseshortname = '';
                    $coursefullname = '';
                    
                    if ($courseid > 0) {
                        $course = get_course($courseid);
                        $courseshortname = format_string($course->shortname, true);
                        $coursefullname = format_string($course->fullname, true);
                    }
                    
                    $modulename = isset($event->modulename) ? $event->modulename : '';
                    $eventname = isset($event->name) ? $event->name : '';
                    $type = $this->infer_event_type($modulename, $eventname);
                    
                    $points = null;
                    if ($courseid > 0 && !empty($event->instance)) {
                        $points = $this->get_grade_max($courseid, $modulename, $event->instance);
                    }
                    
                    $eventdata = array(
                        'id' => isset($event->id) ? $event->id : 0,
                        'courseId' => $courseshortname,
                        'courseTitle' => $coursefullname,
                        'name' => format_string($eventname, true),
                        'dueDate' => isset($event->timestart) ? date('c', $event->timestart) : date('c', $now),
                        'type' => $type,
                        'points' => $points
                    );
                    
                    $events[] = $eventdata;
                }
            }
        }
        
        // Create the iframe container
        $embedurl = rtrim($gameurl, '/') . '/?embed=moodle';
        $iframeid = 'gradedefense_iframe_' . uniqid();
        $containerId = 'gradedefense_container_' . uniqid();
        
        $this->content->text = html_writer::start_div('block-gradedefense-container', array('id' => $containerId));
        $this->content->text .= html_writer::tag('iframe', '', array(
            'id' => $iframeid,
            'src' => $embedurl,
            'class' => 'gradedefense-iframe',
            'title' => get_string('gameframe', 'block_gradedefense')
        ));
        $this->content->text .= html_writer::end_div();
        
        // Prepare the data for postMessage
        $messagedata = array(
            'type' => 'gradedefense:semester',
            'version' => 1,
            'events' => $events
        );
        
        // Hex-escape so names like "</script>" can never break out of the inline script.
        $messageJson = json_encode($messagedata, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        $embedOrigin = $this->get_origin_from_url($embedurl);
        $originJson = json_encode($embedOrigin, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        
        // Add inline JavaScript to handle postMessage
        $js = "
        (function() {
            var iframe = document.getElementById('{$iframeid}');
            var targetOrigin = {$originJson};
            var messageData = {$messageJson};
            
            if (!iframe) return;
            
            function sendData() {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage(messageData, targetOrigin);
                }
            }
            
            // Listen for ready signal from iframe
            window.addEventListener('message', function(event) {
                // Verify origin
                if (event.origin !== targetOrigin || event.source !== iframe.contentWindow) {
                    return;
                }
                
                // Check for ready signal
                if (event.data && event.data.type === 'gradedefense:ready') {
                    sendData();
                }
            });
            
            // Also try sending after a short delay as fallback
            iframe.addEventListener('load', function() {
                setTimeout(sendData, 500);
            });
        })();
        ";
        
        $PAGE->requires->js_amd_inline($js);
        
        return $this->content;
    }
    
    /**
     * Infer event type from module name and event name
     */
    private function infer_event_type($modulename, $eventname) {
        $modulename = strtolower($modulename);
        $eventname = strtolower($eventname);
        
        // Quiz module
        if ($modulename === 'quiz') {
            return 'quiz';
        }
        
        // Check event name for keywords
        if (preg_match('/\b(exam|midterm|final)\b/i', $eventname)) {
            return 'exam';
        }
        
        if (preg_match('/\b(project|proposal)\b/i', $eventname)) {
            return 'project';
        }
        
        if (preg_match('/\b(presentation|present)\b/i', $eventname)) {
            return 'presentation';
        }
        
        // Default to assignment
        return 'assignment';
    }
    
    /**
     * Get grade max for an activity
     */
    private function get_grade_max($courseid, $modulename, $instanceid) {
        global $DB;
        
        if (empty($modulename) || empty($instanceid)) {
            return null;
        }
        
        try {
            $cm = get_coursemodule_from_instance($modulename, $instanceid, $courseid);
            if (!$cm) {
                return null;
            }
            
            $gradeitem = grade_item::fetch(array(
                'itemtype' => 'mod',
                'itemmodule' => $modulename,
                'iteminstance' => $instanceid,
                'courseid' => $courseid
            ));
            
            if ($gradeitem && isset($gradeitem->grademax)) {
                return (float)$gradeitem->grademax;
            }
        } catch (Exception $e) {
            // Return null if we can't get the grade
            return null;
        }
        
        return null;
    }
    
    /**
     * Extract origin (protocol + host + port) from URL
     */
    private function get_origin_from_url($url) {
        $parsed = parse_url($url);
        $origin = $parsed['scheme'] . '://' . $parsed['host'];
        if (isset($parsed['port']) && !in_array($parsed['port'], array(80, 443))) {
            $origin .= ':' . $parsed['port'];
        }
        return $origin;
    }
}
