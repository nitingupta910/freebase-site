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

(function($, fb) {

  fb.homepage = {};

  fb.homepage.update_pointer = function($tab) {
    // First, figure out the selected tab and it's position
    var tab_position = $tab.position();
    var $pointer = $("#pointer");

    if ($pointer.position().top === tab_position.top) {
      return;
    }

    // Update pointer text and position accordingly
    if ($pointer.is(":hidden")) {
      $pointer.css({'top': tab_position.top + 'px' });
    }

    var pointer_text = $tab.text();
    $("#pointer-text").fadeOut(function() {$("#pointer-text").html(pointer_text);});
    $pointer.fadeIn().animate({'top': tab_position.top + 'px' },
                              function() {$("#pointer-text").fadeIn();});
  };

  $.tools.tabs.addEffect("load_pane", function(i, done) {
    var $panes = this.getPanes();
    var $pane = $panes.eq(i);
    var $tab = this.getTabs().eq(i);

    if ($tab.closest("li").is("#tab-all")) {
      $("#all-domains-nav").fadeIn("fast");
      $tab = $(".toc-letter.active > a:first");
      if ($tab.length === 0) {
        $tab = $(".toc-letter > a:first");
      }
      done();
      $tab.click();
      return;
    } else if (!$tab.closest(".domain-explorer-tab").is("#tab-all")) {
      $("#all-domains-nav").hide();
    }

    // Indicator which tab is open with a pointer
    if ($tab.closest("li").is(".toc-letter")) {
      fb.homepage.update_pointer($("#tab-all > a:first"));
      $(".toc-letter").removeClass("active");
      $tab.closest("li").addClass("active");
    } else {
      fb.homepage.update_pointer($tab);
    }

    // only load the pane once
    if ($pane.is(":empty") || $.trim($pane.text()).length == 0) {
      // load it with a page specified in the tab's href attribute
      $("#pointer").queue(function(finished) {
        $("#pointer").addClass("processing");
        finished();
      });
      
      $pane.load($tab.attr("href"), function() {
        $panes.hide();
        fb.homepage.sort_domains($pane);
        $pane.fadeIn(done);
        fb.homepage.init_activity_charts($pane);
        $("#pointer").queue(function(finished) {
          $("#pointer").removeClass("processing");
          finished();
        });
      });
    } else {
      $panes.hide();
      $pane.fadeIn(done);
    };
  });

  fb.homepage.sort_domains = function(scope) {
    var kind = $(".domain-activity-controls select").val();
    var $domains = $("ul.category-domain-list > li.sorted-domain");
    var order = "desc";
    if (kind === "name") {
      order = "asc";
    }
    
    $domains.tsort(".domain-info", {attr: "data-"+kind, order: order, place: "end"});
  };
  
  fb.homepage.init_activity_charts = function(scope) {
    $(".activity-chart-assertions", scope).each(function() {
      var $chart = $(this);
      var weeks = JSON.parse($chart.attr("data-activity"));

      var x = [], edits = [];
      for (var i=1; i < weeks.length; i++) {
        var edit = parseInt(weeks[i].e, 10);
        edits.push([i, edit]);
      }

      var options = {
        grid: {
          show: true,
          color: "#fff",
          borderWidth: 0,
          hoverable: true,
          autoHighlight: true,
          mouseActiveRadius: 3
        },
        legend: {show: false},
        xaxis: {
          tickFormatter: function() {return "";},
          ticks: []
        },
        yaxis: {
          tickFormatter: function() {return "";},
          ticks: []
        }
      };
      var series = {
        data: edits,
        lines: {
          show: true
        },
        points: {
          show: true,
          radius: 2,
          fill: true,
          fillColor: "#f71"
        },
        shadowSize: 0,
        color: "#f71"
      };
      $.plot($chart, [series], options);
    });
  };

  fb.homepage.init = function() {
    var $tabs = $("#domain-explorer-tabs");
    $tabs.tabs("#explorer-panes > div", {
      initialIndex: parseInt($tabs.attr("data-index") || 0, 10),
      effect: "load_pane"
    });

    $(".domain-activity-controls select").change(fb.homepage.sort_domains);
  };

  setTimeout(fb.homepage.init, 0);

})(jQuery, window.freebase);

