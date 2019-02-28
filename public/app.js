
$(document).ready(function () {

    //TODO add a link to the home
    //TODO responsiveness for narrow screen
    //TODO caching for same collections query, add cookie implementation
    //TODO add name of the database
    new Vue({
        el: "#app",
        created: function () {
            this.loading = true;
            var self = this;
            $.ajax({
                url: "query?db=BIOSA&collections",
                dataType: "json",
                success: function (result) {
                    self.collections = result.result;
                    self.loading = false;
                }
            })
        },
        data: {
            collections: null,
            ccList: null,
            mcList: null,
            loading: false,
            showHomeTable: false,
            showCultureTables: false,
            ccGens: [],
            mcGens: [],
            ccHeaders: [],
            mcHeaders: [],
            disableSelect: false,
            selectButtonMsg: "Select Collection",

            // codes below added in spring quarter 2018
            reRender: false, // determine what content to be displayed
            reRenderMCM: false,
            reRenderCCM: false,
            reRenderCompareWeb: false,
            reRenderCompareGraph: false,
            cc_predicted_mutations: [],
            mc_predicted_mutations: [],
            cc_compare_generation: [],
            graph_seq_id: {},
            plotting_data_map: {},
            mutation_headers: ['evidence', 'seq_id', 'position', 'mutation','freq', 'annotation', 'gene', 'description'],
            compare_headers: ['seq_id', 'position', 'mutation', '0', '100', '300', '500', '780', '1000', 'annotation', 'gene', 'description'],
            compare_selection: ['position'],
            checkbox_group_header: ['seq_id', 'gene'],
            inner_checkbox_group_header: ['gene', 'position']

        },
        methods: {
            goHome: function () {
                this.showHomeTable = true;
            },
            populateSequenceIds: function() {
                var seq = $.querySelector("#seq-dropdown");
                this.graph_seq_id.addChild($.create('button'));
                // query for the different seq_ids for the culture
                // populate the vue with those seq_ids, let them be selected
            },
            populateGenes: function() {
                // query for the genes for the selected seq_ids
                // populate the vue with the genes, let them be selected
            },
            populatePositions: function() {
                // query for the positions for the the selected genes
                // populate the vue with the positions, let them be selected
            },
            reset: function () {
                console.log("in reset");
                this.ccGens = [];
                this.mcGens = [];
                this.ccHeaders = [];
                this.mcHeaders = [];
                this.ccList = [];
                this.mcList = [];
                this.cc_predicted_mutations = [];
                this.mc_predicted_mutations = [];
                this.cc_compare_generation = [];
                this.reRender = false;
            },
            getCultures: function (event) {
                console.log("in getCultures");
                this.reset();
                this.disableSelect = true;
                this.selectButtonMsg = "Processing ... ";
                this.loading = true;
                this.showHomeTable = true;
                var collection = event.target.textContent;
                var self = this;

                // querying for ccList and mcList documents, we can't assume we know all cultures ahead of time
                var requestCoculture = $.ajax({
                    url: "query?db=BIOSA&collection=" + collection + "&cultureType=C",
                    dataType: "json"
                });
                var requestMonoculture = $.ajax({
                    url: "query?db=BIOSA&collection=" + collection + "&cultureType=M",
                    dataType: "json"
                });
                $.when(requestCoculture, requestMonoculture).done(function (retC, retM) {
                    self.ccList = retC[0].result;
                    self.ccList.shift();   // be aware that there is a single Ancestor for all samples
                    self.mcList = retM[0].result;

                    // query generations for all monoculture and cocultures
                    var ccResult = [], ccDeferred, ccDeffereds = [];
                    var mcResult = [], mcDeferred, mcDeffereds = [];

                    // query for all generations from cococultures
                    for (var i = 0; i < self.ccList.length; i++) {
                        deferred = $.ajax({
                            url: "query?db=BIOSA&collection=" + collection + "&cultureType=C&culture=" + self.ccList[i],
                            dataType: "json",
                            success: function (result) {
                                ccResult.push(result);
                            }
                        });
                        ccDeffereds.push(ccDeferred);
                    }

                    //query for all generations from mcList
                    for (var i = 0; i < self.mcList.length; i++) {
                        deferred = $.ajax({
                            url: "query?db=BIOSA&collection=" + collection + "&cultureType=M&culture=" + self.mcList[i],
                            dataType: "json",
                            success: function (result) {
                                mcResult.push(result);
                            }
                        });
                        mcDeffereds.push(mcDeferred);
                    }

                    // runs when all ajax queries for mc/cc gens are finished, and resets it back
                    $(document).ajaxStop(function () {
                        self.processResults(ccResult, "cc");
                        self.processResults(mcResult, "mc");
                        //self.normalizeHeader();
                        self.fillEmptySlots(self.ccGens, self.ccHeaders, true);
                        self.fillEmptySlots(self.mcGens, self.mcHeaders, false);
                        self.loading = false;
                        self.disableSelect = false;
                        self.selectButtonMsg = "Select Collection";
                        $(this).off("ajaxStop");
                    });
                });
            },
            processResults: function (result, cultureType) {
                console.log("in processResults");
                var self = this;
                var tempGenList = [];

                result.forEach(function (obj) {
                    var temp = {};
                    var currGenList = obj.result;  // list of generations for the current culture

                    if (cultureType === "cc") {
                        currGenList.unshift(0);   // insert a 0th generation
                    }
                    temp["culture"] = obj.culture;
                    temp["generations"] = currGenList;

                    if (cultureType === "cc") {
                        self.ccGens.push(temp);
                    }

                    else {
                        self.mcGens.push(temp);
                    }
                    tempGenList = currGenList.concat(tempGenList);  // extract unique generations
                    tempGenList = _.uniq(tempGenList);

                });

                // set the data's
                if (cultureType === "cc") {
                    self.ccGens = _.orderBy(self.ccGens, 'culture');
                    self.ccHeaders = tempGenList;
                    self.ccHeaders.unshift("Coculture");
                    self.ccHeaders.push("Compare");
                }
                else {
                    self.mcGens = _.orderBy(self.mcGens, 'culture');
                    self.mcHeaders = tempGenList.sort();
                    self.mcHeaders.unshift("Monoculture");
                    // self.mcHeaders.push("Compare");

                }
            },
            fillEmptySlots: function (cultureGens, header, requireCompare) {
                console.log("in fillEmptySlots");
                var self = this;
                var gensList = cultureGens.map(function (currCulture) {
                    return currCulture.generations
                });

                gensList.forEach(function (currGenList) {
                    header.slice(1).forEach(function (currHeadGen, index) {  // header will always be >= list of gens for each culture
                        var otherGen = currGenList[index];
                        if (otherGen !== currHeadGen) {
                            if (otherGen > currHeadGen) { // insert before curr Index
                                currGenList.splice(index, 0, " ");
                            }
                            else {                        // insert after curr Index
                                currGenList.splice(index + 1, 0, " ");
                            }
                        }
                    });
                    if (requireCompare){
                        currGenList[currGenList.length-1] = "compare";
                    }
                });
            },
            normalizeHeader: function () {
                console.log("in normalizeHeader");
                var base;
                var normalize;
                if (this.ccHeaders.length > this.mcHeaders.length) {
                    base = this.ccHeaders;
                    normalize = this.mcHeaders;
                }
                else {
                    base = this.mcHeaders;
                    normalize = this.ccHeaders;
                }

                var index = 1;
                while (index < base.length) {
                    var master = base[index];
                    var child = normalize[index];
                    if (master !== child) {
                        if (child > master) {
                            normalize.splice(index, 0, master);
                        }
                        else {
                            normalize.splice(index + 1, 0, master);
                        }
                    }
                    index++;
                }
            },

            // this function is to change the state of reRender variable and help determine what corresponding table should be displayed
            reactToButtons: function(){
                console.log("in reactToButtons");
                this.reRender = !this.reRender;
            },
            generateCCTable: function(event){
                console.log("in generateCCTable");
                this.showHomeTable = false;
                this.reRenderMCM = false;
                this.reRenderCCM = true
                this.reRenderCompareGraph = false;
                this.loading = true;
                var self = this;
                $("#gen-cc-table td").click(function() {
                    var column_num = parseInt( $(this).index() )-1;
                    var row_num = parseInt( $(this).parent().index() );

                    var gen = String(self.ccGens[row_num].generations[column_num]);
                    var cul = String(self.ccList[row_num]);

                    if (cul != "" && gen != " " && gen != "compare"){
                        var requestTable = $.ajax({
                            url: "query?db=BIOSA&collection=CULTURES_02232018&cultureType=C&culture=" + cul + "&generation=" + gen,
                            dataType: "json"
                        });
                        $.when(requestTable).done(function (retT) {

                            // make a map for evidences data
                            var evidence_data_map = {};
                            for (var i = 0; i < retT.result.evidences.length; i++) {
                                var data = retT.result.evidences[i];
                                evidence_data_map[data.evidence_id] = [data.type, data.ref_base, data.new_base];
                            }

                            // query for all generations from cocultures
                            for (var i = 0; i < retT.result.mutations.length; i++) {
                                var data = retT.result.mutations[i];
                                // this if else is for finding gene
                                var gene_name_value = null;
                                if (data.hasOwnProperty("gene_name")) {
                                    if (data.hasOwnProperty("gene_strand")){
                                        gene_name_value = data.gene_name + " " + data.gene_strand;
                                    }
                                    else{
                                        gene_name_value = data.gene_name;
                                    }
                                }

                                // this part is for finding annotation
                                var annotation_value = null;
                                if (data.type === "DEL" && !data.hasOwnProperty("gene_position")){
                                    // some DELs don't have gene_position, keeps it null
                                }
                                else if (data.type !== "SNP" || data.gene_position){
                                    annotation_value = data.gene_position;
                                }
                                else{   // this is for SNP without gene_position
                                    annotation_value = data.aa_ref_seq + data.aa_position + data.aa_new_seq
                                        + " (" + data.codon_ref_seq + "->" + data.codon_new_seq + ")";
                                }

                                // // this part formats frequency
                                var freq_val = ((Number(data.frequency)) * 100).toFixed(1);
                                if (freq_val === "100.0"){
                                    freq_val = "100%";
                                }
                                else{
                                    freq_val = freq_val + "%";
                                }

                                // this part is for evidence field
                                var evid_types = "";
                                var parent_ids = data.parent_ids;
                                var parent_id_list = parent_ids.split(",");

                                for (var j = 0; j < parent_id_list.length; j++){
                                    evid_types += evidence_data_map[parent_id_list[j]][0];

                                }

                                // this part is for mutation
                                var mutation = "";
                                if (data.type === "INS"){
                                    mutation = "+" + data.new_seq;
                                }
                                else if (data.type === "DEL"){
                                    mutation = "∆" + data.size + " bp";
                                }
                                else if (data.type === "SUB"){
                                    mutation = data.size + " bp -> " + data.new_seq;
                                }
                                else if (data.type === "MOB"){
                                    if(data.strand === "1"){
                                        mutation = data.repeat_name + "+" + data.duplication_size + " bp";
                                    }else{
                                        mutation = data.repeat_name + "-" + data.duplication_size + " bp";
                                    }
                                }
                                else if (data.type === "SNP"){
                                    mutation = evidence_data_map[data.parent_ids][1] + "->" + evidence_data_map[data.parent_ids][2];
                                }

                                var evidence_obj = {
                                    evidence_type: evid_types,
                                    seq_id: data.seq_id,
                                    position: data.position,
                                    mutation_field: mutation,
                                    freq: freq_val,
                                    annotation: annotation_value,
                                    gene: gene_name_value,
                                    description: data.gene_product
                                };

                                self.cc_predicted_mutations.push(evidence_obj);
                            }

                        });
                    }
                    else
                    {
                        console.log("we are in else");
                    }

                    // runs when all ajax queries for mc/cc gens are finished, and resets it back
                    $(document).ajaxStop(function () {
                        self.loading = false;
                        $(this).off("ajaxStop");
                    });
                });
            },
            generateMCTable: function(event){
                console.log("in generateMCTable");
                this.showHomeTable = false;
                this.reRenderMCM = true;
                this.reRenderCCM = false;
                this.reRenderCompareGraph = false;
                var self = this;
                $("#gen-mc-table td").click(function() {
                    var column_num = parseInt( $(this).index() )-1;
                    var row_num = parseInt( $(this).parent().index() );

                    var gen = String(self.mcGens[row_num].generations[column_num]);
                    var cul = String(self.mcList[row_num]);

                    if (cul != "" && gen != " "){
                        var requestTable = $.ajax({
                            url: "query?db=BIOSA&collection=CULTURES_02232018&cultureType=M&culture=" + cul + "&generation=" + gen,
                            dataType: "json"
                        });
                        $.when(requestTable).done(function (retT) {

                            // make a map for evidences data
                            var evidence_data_map = {};
                            for (var i = 0; i < retT.result.evidences.length; i++) {
                                var data = retT.result.evidences[i];
                                evidence_data_map[data.evidence_id] = [data.type, data.ref_base, data.new_base];
                            }

                            // query for all generations from cococultures
                            for (var i = 0; i < retT.result.mutations.length; i++) {
                                var data = retT.result.mutations[i];

                                // this if else is for finding gene
                                var gene_name_value = null;
                                if (data.hasOwnProperty("gene_name")) {
                                    if (data.hasOwnProperty("gene_strand")){
                                        gene_name_value = data.gene_name + " " + data.gene_strand;
                                    }
                                    else{
                                        gene_name_value = data.gene_name;
                                    }
                                }

                                // this part is for finding annotation
                                var annotation_value = null;
                                if (data.type === "DEL" && !data.hasOwnProperty("gene_position")){
                                    // some DELs don't have gene_position, keeps it null
                                }
                                else if (data.type !== "SNP" || data.gene_position){
                                    annotation_value = data.gene_position;
                                }
                                else{   // this is for SNP without gene_position
                                    annotation_value = data.aa_ref_seq + data.aa_position + data.aa_new_seq
                                        + " (" + data.codon_ref_seq + "->" + data.codon_new_seq + ")";
                                }

                                // // this part formats frequency
                                var freq_val = ((Number(data.frequency)) * 100).toFixed(1);
                                if (freq_val === "100.0"){
                                    freq_val = "100%";
                                }
                                else{
                                    freq_val = freq_val + "%";
                                }

                                // this part is for evidence field
                                var evid_types = "";
                                var parent_ids = data.parent_ids;
                                var parent_id_list = parent_ids.split(",");

                                for (var j = 0; j < parent_id_list.length; j++){
                                    evid_types += evidence_data_map[parent_id_list[j]][0];

                                }

                                // this part is for mutation
                                var mutation = "";
                                if (data.type === "INS"){
                                    mutation = "+" + data.new_seq;
                                }
                                else if (data.type === "DEL"){
                                    mutation = "∆" + data.size + " bp";
                                }
                                else if (data.type === "SUB"){
                                    mutation = data.size + " bp -> " + data.new_seq;
                                }
                                else if (data.type === "MOB"){
                                    if(data.strand === "1"){
                                        mutation = data.repeat_name + "+" + data.duplication_size + " bp";
                                    }else{
                                        mutation = data.repeat_name + "-" + data.duplication_size + " bp";
                                    }
                                }
                                else if (data.type === "SNP"){
                                    mutation = evidence_data_map[data.parent_ids][1] + "->" + evidence_data_map[data.parent_ids][2];
                                }

                                var evidence_obj = {
                                    description: data.gene_product,
                                    freq: freq_val,
                                    position: data.position,
                                    seq_id: data.seq_id,
                                    gene: gene_name_value,
                                    annotation: annotation_value,
                                    evidence_type: evid_types,
                                    mutation_field: mutation
                                };

                                self.mc_predicted_mutations.push(evidence_obj);
                            }

                        });
                    }
                    else
                    {
                        console.log("we are in else");
                    }
                    $(document).ajaxStop(function () {
                        self.loading = false;
                        $(this).off("ajaxStop");
                    });
                });
            },
            generateCompareTable: function(event){
                console.log("in generateCompareTable");
                this.showHomeTable = false;
                this.reRenderMCM = false;
                this.reRenderCCM = false;
                this.reRenderCompareWeb = true;
                this.reRenderCompareGraph = false;
                this.loading = true;
                var self = this;
                $("#gen-cc-table td").click(function() {
                    var column_num = parseInt( $(this).index() )-1;
                    var row_num = parseInt( $(this).parent().index() );

                    var gen = String(self.ccGens[row_num].generations[column_num]);
                    var cul = String(self.ccList[row_num]);
                    if (cul != "" && gen === "compare") {

                        var requestTable = $.ajax({
                            url: "query?db=BIOSA&collection=CULTURES_02232018&cultureType=C&culture=" + cul+ "&generation=" + gen,
                            dataType: "json"
                        });
                        $.when(requestTable).done(function (retT) {

                            // make a map for evidences data
                            var evidence_data_map = {};
                            for (var res in retT.result) {
                                var data = retT.result[res];

                                var seq_id = data.seq_id[0];

                                var type = data.type[0];
                                var mutation_data = data.mutation[0];
                                var mutation = "";
                                switch(type) {
                                    case "INS":
                                        mutation = "+" + mutation_data.new_seq;
                                        break;
                                    case "DEL":
                                        mutation = "∆" + mutation_data.size + " bp";
                                        break;
                                    case "SUB":
                                        mutation = mutation_data.size + " bp -> " + mutation_data.new_seq;
                                        break;
                                    case "MOB":
                                        if (mutation_data.strand === "1") {
                                            mutation = mutation_data.repeat_name + "+" + mutation_data.duplication_size + " bp";
                                        } else {
                                            mutation = mutation_data.repeat_name + "-" + mutation_data.duplication_size + " bp";
                                        }
                                        break;
                                    case "SNP":
                                        mutation = mutation_data.ref_base + "->" + mutation_data.new_base;
                                        break;
                                }

                                var freq_map = {
                                    freq_0: 0,
                                    freq_100: 0,
                                    freq_300: 0,
                                    freq_500: 0,
                                    freq_780: 0,
                                    freq_1000: 0
                                };
                                for (var index in data.frequency) {
                                    var frequency = "freq_" + data.frequency[index].generation;
                                    freq_map[frequency] = (parseFloat(data.frequency[index].freq)*100).toFixed(1);
                                }

                                var annotation_data = data.annotation[0];
                                var annotation = "";
                                if (type !== "SNP" || annotation_data.gene_position){
                                    annotation = annotation_data.gene_position;
                                }
                                else {
                                    annotation = annotation_data.aa_ref_seq + annotation_data.aa_position + annotation_data.aa_new_seq
                                        + " (" + annotation_data.codon_ref_seq + "->" + annotation_data.codon_new_seq + ")";
                                }

                                var gene_data = data.gene[0];
                                var gene = "";
                                if (gene_data.hasOwnProperty("gene_strand")) {
                                    gene = gene_data.gene_name + " " + gene_data.gene_strand;
                                } else {
                                    gene = gene_data.gene_name;
                                }

                                var description = data.description[0];

                                var compare_obj = {
                                    seq_id: seq_id,
                                    position: data._id,
                                    mutation: mutation,
                                    freq_0: freq_map.freq_0,
                                    freq_100: freq_map.freq_100,
                                    freq_300: freq_map.freq_300,
                                    freq_500: freq_map.freq_500,
                                    freq_780: freq_map.freq_780,
                                    freq_1000: freq_map.freq_1000,
                                    annotation: annotation,
                                    gene: gene,
                                    description: description
                                };
                                self.cc_compare_generation.push(compare_obj);
                            }

                        });
                    }
                    $(document).ajaxStop(function () {
                        self.loading = false;
                        $(this).off("ajaxStop");
                    });
                });
            },
            generateCompareGraph: function(event) {
                console.log("in generateCompareGraph");
                this.showHomeTable = false;
                this.reRenderMCM = false;
                this.reRenderCCM = false;
                this.reRenderCompareWeb = false;
                this.reRenderCompareGraph = true;
                this.loading = true;
                var self = this;
                $("#gen-cc-table td").click(function() {
                    var column_num = parseInt( $(this).index() )-1;
                    var row_num = parseInt( $(this).parent().index() );

                    var gen = String(self.ccGens[row_num].generations[column_num]);
                    var cul = String(self.ccList[row_num]);
                    var plotting_data = [];
                    var temp_data = {};
                    if (cul != "" && gen === "compare") {

                        var requestTable = $.ajax({
                            url: "query?db=BIOSA&collection=CULTURES_02232018&cultureType=C&culture=" + cul+ "&generation=" + gen,
                            dataType: "json"
                        });
                        $.when(requestTable).done(function (retT) {
                            for (var res in retT.result) {
                                var data = retT.result[res];

                                var seq_id = data.seq_id[0];
                                var gene = data.gene[0];
                                var temp_gene;

                                if (gene.hasOwnProperty("gene_strand")) {
                                    temp_gene = gene.gene_name;
                                } else {
                                    temp_gene = gene.gene_name;
                                }
                                temp_data['All'] = true;
                                if (temp_data[seq_id] === undefined) {
                                    temp_data[seq_id] = {};
                                }
                                temp_data[seq_id]["seqId_state"] = true;
                                if (temp_data[seq_id][temp_gene] === undefined) {
                                    temp_data[seq_id][temp_gene] = {};
                                }
                                temp_data[seq_id][temp_gene]["gene_state"] = true;
                                temp_data[seq_id][temp_gene][data._id] = true;

                                var freq_map = {
                                    freq_0: 0,
                                    freq_100: 0,
                                    freq_300: 0,
                                    freq_500: 0,
                                    freq_780: 0,
                                    freq_1000: 0
                                };

                                for (var index in data.frequency) {
                                    var frequency = "freq_" + data.frequency[index].generation;
                                    freq_map[frequency] = (parseFloat(data.frequency[index].freq)*100).toFixed(1);
                                }

                                var trace = {
                                    x: [0, 100, 300, 500, 780, 1000],
                                    y: [
                                        parseFloat(freq_map.freq_0),
                                        parseFloat(freq_map.freq_100),
                                        parseFloat(freq_map.freq_300),
                                        parseFloat(freq_map.freq_500),
                                        parseFloat(freq_map.freq_780),
                                        parseFloat(freq_map.freq_1000)
                                    ],
                                    name: seq_id + " " + data._id,
                                    type: 'scatter'
                                };
                                var position = data._id;
                                self.plotting_data_map[position] = data;
                                plotting_data.push(trace);

                                var compare_obj = {
                                    seq_id: seq_id,
                                    position: data._id,
                                    freq_0: freq_map.freq_0,
                                    freq_100: freq_map.freq_100,
                                    freq_300: freq_map.freq_300,
                                    freq_500: freq_map.freq_500,
                                    freq_780: freq_map.freq_780,
                                    freq_1000: freq_map.freq_1000,
                                };
                                self.cc_compare_generation.push(compare_obj);
                            }
                            self.graph_seq_id = temp_data;
                            Plotly.plot(document.getElementById('compareGraph'), plotting_data, layout, {responsive: true});
                        });

                        var layout = {
                            title: "Graph",
                            font: {size: 12}
                        };

                        $(document).ajaxStop(function () {
                            self.loading = false;
                            $(this).off("ajaxStop");
                        });
                    }

                });
            },
            geneSelect: function (e, positions) {
                console.log("in geneSelect");
                for (var position in positions) {
                    positions[position] = e.target.checked;
                }
            },
            seqIdSelect: function (e, gene_map) {
                console.log("in seqIdSelect");
                for (var gene in gene_map) {
                    for (var position in gene_map[gene]) {
                        gene_map[gene][position] = e.target.checked;
                    }
                }
                var tr = e.target.parentNode.parentNode.parentNode;
                var gene_table = tr.lastChild.lastChild;
                if (e.target.checked) {
                    gene_table.removeAttribute("style");
                } else {
                    gene_table.style.display = "none";
                }
            },
            selectAllSelect: function (e) {
                console.log("in selectAllSelect");
                var self = this;
                self.graph_seq_id['All'] = e.target.checked;
                for (var seqId in self.graph_seq_id) {
                    self.graph_seq_id[seqId]['seqId_state'] = e.target.checked;
                    for (var gene in self.graph_seq_id[seqId]) {
                        self.graph_seq_id[seqId][gene]['gene_state'] = e.target.checked;

                        for (var position in self.graph_seq_id[seqId][gene]){
                            self.graph_seq_id[seqId][gene][position] = e.target.checked;

                        }
                    }
                }

            },

            graphCompare: function (event) {
                console.log("in graphCompare");
                var chkArray = [];
                var plotting_data = [];

                var self = this;
                for (var seqId in self.graph_seq_id) {
                    for (var gene in self.graph_seq_id[seqId]) {
                        for (var position in self.graph_seq_id[seqId][gene]){
                            if (self.graph_seq_id[seqId][gene][position] && position !== 'gene_state'){
                                chkArray.push(position);
                            }
                        }
                    }
                }

                for (var position in chkArray) {

                    var freq_map = {
                        freq_0: 0,
                        freq_100: 0,
                        freq_300: 0,
                        freq_500: 0,
                        freq_780: 0,
                        freq_1000: 0
                    };

                    var data = self.plotting_data_map[chkArray[position]];
                    var seq_id = data.seq_id;
                    for (var index in data.frequency) {
                        var frequency = "freq_" + data.frequency[index].generation;
                        freq_map[frequency] = (parseFloat(data.frequency[index].freq)*100).toFixed(1);
                    }

                    var trace = {
                        x: [0, 100, 300, 500, 780, 1000],
                        y: [
                            parseFloat(freq_map.freq_0),
                            parseFloat(freq_map.freq_100),
                            parseFloat(freq_map.freq_300),
                            parseFloat(freq_map.freq_500),
                            parseFloat(freq_map.freq_780),
                            parseFloat(freq_map.freq_1000)
                        ],
                        name: seq_id + " " + data._id,
                        type: 'scatter'
                    };
                    plotting_data.push(trace);
                }
                var layout = {
                    title: "Graph",
                    font: {size: 12}
                };
                Plotly.newPlot(document.getElementById('compareGraph'), plotting_data, layout, {responsive: true});
            }
        }
    });
});

