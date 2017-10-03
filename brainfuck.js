// interactive input mode:
// 
// a     ascii char
// #97   decimal char index
// !141  octal char index
// $61   hex char index
var valid_ops = ['>','<','+','-','.',',','[',']',')','(','@','$','=','_','}','{','|','^','&','#','%'];
var g_debugging = 0;
var g_memory = [];
var g_stack = [];
var g_max_mem = 256;
var g_max_val = 255;
var g_ip = 0;
var g_mempointer = 0;
var g_dp = 0;
var g_program = [];
var g_targets = [];
var g_input = [];
var g_output = '';
var g_viewer_width = 60;
var g_quit_debug_run = 0;
var g_debugging_running = 0;
var g_prompt_for_input = 0;
var g_running = 0;

var g_documentation = [
    'Point to the next cell on the right.\r\n',
    'Point to the next cell on the left.\r\n',
    'Increment the byte at the pointer by one.\r\n',
    'Decrement the byte at the pointer by one.\r\n',
    'Output the value of the byte at the pointer.\r\n',
    'Accept one byte of input, storing its value in the current cell.\r\n',
    'Jump forward to the command after the corresponding ]\nif the byte at the pointer is zero.',
    'Jump back to the command after the corresponding [\nif the byte at the pointer is nonzero.',
    'Push the value at the current cell onto the stack.\r\n',
    'Pop the value on the stack into the current cell\n(an empty stack pops zero into the cell)',
    'Copy value at the top of the stack into the current cell without popping it\r\n',
    'Drop the value on the stack (as if it was popped), but do not\n write it to the cell',
    'Current cell is set to the SUM between its value and the value on\nthe top of the stack (peek)',
    'current cell is set to the DIFFERENCE between its value and the\nvalue on the top of the stack (peek)',
    'Bitshift the current cell value right by the value on the top of\n the stack (peek)',
    'Bitshift the current cell value left by the value on the top of\nthe stack (peek)',
    'Set current cell to the bitwise OR between its value and the\nvalue on the top of the stack (peek)',
    'Set current cell to the bitwise XOR between its value and the\nvalue on the top of the stack (peek)',
    'Set current cell to the bitwise AND between its value and the\nvalue on the top of the stack (peek) ',
    'Stop executing until button is clicked\r\n',
    'Clear current cell. (optimised version of \'[-]\')\r\n'
];

function init(){
    disable_button('button_step');
    disable_button('button_run_debug');
    change_button_caption('button_run_debug', 'Run To Breakpoint (c)');
    document.addEventListener('keypress', function(e) {
        //n for single step
        if (e.keyCode == 110)
            document.getElementById('button_step').click();
        //c for run to next breakpoint
        else if (e.keyCode == 99)
            document.getElementById('button_run_debug').click();
    }, false);
}

function get_input(){
    if (g_prompt_for_input){
        var data = window.prompt("Enter an input character (use #xxx to specify a decimal code, !xxx for an octal code, or $xxx for a hex code):", "#0");
        if ((data == null) || (!data)) return 0;
        if (data.charAt(0) == '#'){
            return parseInt(data.substr(1), 10);
        }
        if (data.charAt(0) == '!'){
            return parseInt(data.substr(1), 8);
        }
        if (data.charAt(0) == '$'){
            return parseInt(data.substr(1), 16);
        }
        return data.charCodeAt(0);
    }else{
        var result = (g_dp >= g_input.length)?0:g_input[g_dp].charCodeAt(0);
        g_dp++;
        return result;
    }
}


function execute_opcode(op){
    switch(op){
        case '+':
            g_memory[g_mempointer]++;
            if (g_memory[g_mempointer] > g_max_val) g_memory[g_mempointer] = 0;
            break;
        case '-':
            g_memory[g_mempointer]--;
            if (g_memory[g_mempointer] < 0) g_memory[g_mempointer] = g_max_val;
            break;
        case '>':
            g_mempointer++;
            if (g_mempointer >= g_max_mem) g_mempointer = 0;
            break;
        case '<':
            g_mempointer--;
            if (g_mempointer < 0) g_mempointer = g_max_mem-1;
            break;
        case '[':
            if (g_memory[g_mempointer] == 0) g_ip = g_targets[g_ip];
            break;
        case ']':
            g_ip = g_targets[g_ip] - 1;
            break;
        case '.':
            g_output += String.fromCharCode(g_memory[g_mempointer]);
            break;
        case ',':
            g_memory[g_mempointer] = get_input();
            break;
        case ')':
            g_stack.push(g_memory[g_mempointer]);
            break;
        case '(':
            g_memory[g_mempointer] = g_stack.pop();
            break;
        case '@':
            g_memory[g_mempointer] = g_stack[g_stack.length-1];
            break;
        case '$':
            g_stack.pop();
            break;
        case '=':
            g_memory[g_mempointer] += g_stack[g_stack.length-1];
            break;
        case '_':
            g_memory[g_mempointer] -= g_stack[g_stack.length-1];
            break;
        case '}':
            g_memory[g_mempointer] >>= g_stack[g_stack.length-1];
            break;
        case '{':
            g_memory[g_mempointer] <<= g_stack[g_stack.length-1];
            break;
        case '|':
            g_memory[g_mempointer] |= g_stack[g_stack.length-1];
            break;
        case '^':
            g_memory[g_mempointer] ^= g_stack[g_stack.length-1];
            break;
        case '&':
            g_memory[g_mempointer] &= g_stack[g_stack.length-1];
            break;
        case '%':
            g_memory[g_mempointer] = 0;
    }
    g_memory[g_mempointer] %= 256;
}

function bf_interpret(prog, input){

    if (g_running){
        bf_stop_run();
        return;
    }
    g_running = 1;
    
    init_elements(prog);
    disable_text_box('edit_source');
    disable_text_box('edit_input');
    disable_text_box('edit_output');
    disable_text_box('edit_progs');
    disable_button('input_mode_1');
    disable_button('input_mode_2');
    disable_button('button_debug');
    change_button_caption('button_run', 'Stop');

    bf_run_step();
}

function bf_stop_run(){
    enable_text_box('edit_source');
    enable_text_box('edit_input');
    enable_text_box('edit_output');
    enable_text_box('edit_progs');
    enable_button('input_mode_1');
    enable_button('input_mode_2');
    enable_button('button_debug');
    change_button_caption('button_run', 'Run');
    sync_input();

    g_running = 0;
}
function bf_run_step(){
    while (g_ip > g_program.length){
        execute_opcode(g_program[g_ip]);
        g_ip++;
    }
    bf_stop_run();
    document.getElementById('edit_output').value = g_output;
    return;
}

function set_viewdata(view, data){
    var new_node = document.createTextNode(data);
    var p_node = document.getElementById(view);
    p_node.replaceChild(new_node, p_node.childNodes[0]);
}

function debug_toggle(f){
    if (g_debugging == 1){
        g_debugging = 0;
        enable_text_box('edit_source');
        enable_text_box('edit_input');
        enable_text_box('edit_output');
        enable_text_box('edit_progs');
        enable_button('button_run');
        enable_button('input_mode_1');
        enable_button('input_mode_2');
        change_button_caption('button_debug', 'Start Debugger');
        disable_button('button_step');
        disable_button('button_run_debug');
        set_viewdata('explanation', ' ');
        set_viewdata('progview', ' ');
        set_viewdata('stackview', ' ');
        set_viewdata('memview', ' ');
        set_viewdata('inputview', ' ');
        set_viewdata('outputview', ' ');
        sync_input();
    }else{
        g_debugging = 1;
        disable_text_box('edit_source');
        disable_text_box('edit_input');
        disable_text_box('edit_output');
        disable_text_box('edit_progs');
        disable_button('button_run');
        disable_button('input_mode_1');
        disable_button('input_mode_2');
        change_button_caption('button_debug', 'Quit Debugger');
        enable_button('button_step');
        enable_button('button_run_debug');
        init_elements(document.getElementById('edit_source').value);
        update();
    }
}


function update_memview(){
    var mem_slots = Math.floor(g_viewer_width / 4);
    var pre_slots = Math.floor(mem_slots / 2);
    var low_slot = g_mempointer - pre_slots;
    if (low_slot < 0) low_slot += g_max_mem;

    var line_1 = '';
    var line_4 = '';
    for(var i=0; i<mem_slots; i++){
        var slot = low_slot + i;
        if (slot >= g_max_mem) slot -= g_max_mem;
        var label1 = pad_num(g_memory[slot]);
        line_1 += label1 + ' ';
        var label4 = pad_num(slot);
        line_4 += label4 + ' ';
    }
    
    var line_3 = '';
    var line_2 = line_3 = '    '.repeat(pre_slots);
    line_2 += '^';
    line_3 += 'mp='+g_mempointer;

    set_viewdata('memview', line_1 + '\r\n' + line_2 + '\r\n' + line_3 + '\r\n' + line_4);
}

function update_stackview(){
    var line_1 = '';
    var line_2 = '';
    for(var i=g_stack.length; i>0; i--){
        line_1 += pad_num(g_stack[i-1]) + ' ';
    }
    if (line_1 != '') {
        line_2 = '^';
    }
    set_viewdata('stackview', line_1 + '\r\n' + line_2);
}

function update_explanation(){
    var currentop = g_program[g_ip];
    if (currentop == undefined){
        set_viewdata('explanation', 'End of program');
        return;
    }
    set_viewdata('explanation', g_documentation[valid_ops.indexOf(currentop)]);
}

function pad_num(str) {
    return ('000' + str).slice(-3);
}

function update_progview(){
    var pre_slots = Math.floor(g_viewer_width / 2);
    var low_slot = g_ip - pre_slots;

    var line_1 = '';
    for(var i=0; i<g_viewer_width; i++){
        var slot = low_slot + i;
        if ((slot >= 0) && (slot < g_program.length)){
            line_1 += g_program[slot];
        }else{
            line_1 += '_';
        }
    }
    var line_3 = '';
    var line_2 = line_3 = ' '.repeat(pre_slots);
    line_2 += '^';
    line_3 += 'ip='+g_ip;

    set_viewdata('progview', line_1 + '\r\n' + line_2 + '\r\n' + line_3);
}

function update_inputview(){
    if(!g_prompt_for_input){
        var input_locator = '';
        for (var i=0; i<g_dp; i++) input_locator += ' ';
        input_locator += '^';
        set_viewdata('inputview', g_input.join('') + '\r\n' + input_locator);
        return;
    }
    set_viewdata('inputview', "-input prompt mode-");
}

function update_outputview(){
    var output_locator = '';
    for (var i=0; i<g_output.length; i++) output_locator += ' ';
    output_locator += '^';
    set_viewdata('outputview', g_output + '\r\n' + output_locator);
}

function update(){
    update_memview();
    update_explanation();
    update_stackview();
    update_progview();
    update_inputview();
    update_outputview();
}

function init_elements(prog){
    for(var i=0; i<=g_max_mem; i++){
        g_memory[i] = 0;
    }
    g_mempointer = 0;
    g_stack.length = 0;
    g_output = '';
    prog = prog.replaceAll('[-]','%').replaceAll('[]','').replaceAll(' ','').replaceAll('\n','').replaceAll('\r','');
    // remove useless +- and <> combinations
    prog = prog.replace(/[\+\-]*(?:\+-|-\+)[\+\-]*/g,combine_char.bind(this, "+", "-"));
    prog = prog.replace(/[<>]*(?:<>|><)[<>]*/g,combine_char.bind(this, "<", ">"));    
    g_program.length = 0;
    g_ip = 0;
    g_targets.length = 0;
    var temp_stack = [];
    for(i=0; i<prog.length; i++){
        var op = prog.charAt(i);
        // check it's not a carriage return or anything that will
        //  break the program viewer too badly :)
        if (valid_ops.includes(op)){
            
            g_program[g_program.length] = op;
            if (op == '['){
                temp_stack.push(i);
            }
            if (op == ']'){
                if (temp_stack.length == 0) alert('Parsing error: ] with no matching [');
                var target = temp_stack.pop();
                g_targets[i] = target;
                g_targets[target] = i;
            }
        }
    }    

    if (temp_stack.length > 0) alert('Parseing error: [ with no matching ]');
    
    
    g_prompt_for_input = document.getElementById('input_mode_1').checked;
    g_input.length = 0;
    var in_data = document.getElementById('edit_input').value;
    for(i=0; i<in_data.length; i++){
        g_input[g_input.length] = in_data.charAt(i);
    }    
    g_dp = 0;
}

function run_step(){
    execute_opcode(g_program[g_ip]);
    g_ip++;
    update();
    if (g_ip >= g_program.length){
        disable_button('button_step');
        disable_button('button_run_debug');
    }
}

function run_debug(){
    if (g_debugging_running){
        g_quit_debug_run = 1;
    }else{
        disable_button('button_debug');
        disable_button('button_step');
        change_button_caption('button_run_debug', 'Stop Running (c)');
        g_debugging_running = 1;
        g_quit_debug_run = 0;
        run_debug_step();
    }
}

function run_debug_step(){
    while (g_program[g_ip] != '#' && !g_quit_debug_run && g_ip < g_program.length){
        run_step();
    }
    g_ip++;
    enable_button('button_debug');
    enable_button('button_step');
    change_button_caption('button_run_debug', 'Run To Breakpoint (c)');
    g_debugging_running = 0;
    return;
}

function combine_char(pos, neg, code) {
    var sum = 0;

    for(var i = 0; i < code.length; i++) {
        if(code[i] === pos) {
            sum++;
        }
        else if(code[i] === neg) {
            sum--;
        }
        else {
            throw "Invalid match: " + code[i];
        }
    }
    if(sum >= 0){
        return Array(sum + 1).join(pos);
    }
    else {
        return Array(-sum + 1).join(neg);
    }
}

String.prototype.replaceAll = function(search, replacement) {
    return this.split(search).join(replacement);
};

function disable_text_box(name){
    var elm = document.getElementById(name);
    elm.disabled = true;
    elm.style.backgroundColor = '#cccccc';
}

function enable_text_box(name){
    var elm = document.getElementById(name);
    elm.disabled = false;
    elm.style.backgroundColor = '';
}

function disable_button(name){
    document.getElementById(name).disabled = true;
}

function enable_button(name){
    document.getElementById(name).disabled = false;
}

function change_button_caption(name, caption){
    document.getElementById(name).value = caption;
}

function sync_input(){
    if (document.getElementById('input_mode_1').checked){
        disable_text_box('edit_input');
    }else{
        enable_text_box('edit_input');
    }
}
