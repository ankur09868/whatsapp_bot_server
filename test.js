class Stack {
    constructor() {
        this.items = []; // Internal array to store stack elements
    }

    // Push an element onto the stack
    push(element) {
        this.items.push(element);
    }

    // Pop an element from the stack
    pop() {
        if (this.isEmpty()) {
            return "Stack is empty";
        }
        return this.items.pop();
    }

    // Peek at the top element without removing it
    peek() {
        if (this.isEmpty()) {
            return "Stack is empty";
        }
        return this.items[this.items.length - 1];
    }

    // Check if the stack is empty
    isEmpty() {
        return this.items.length === 0;
    }

    // Get the size of the stack
    size() {
        return this.items.length;
    }

    // Clear the stack
    clear() {
        this.items = [];
    }
}

const text = "{'type': 'text', 'text':\"Im 'Don'\"}"

async function fixText(text){
    const stack = new Stack()
    let fixedJson = ""
    let str=""
    for(let i=0;i<text.length;i++){
        const char = text.charAt(i) // char: {'type': 'text', 'text': 'hey'
        if(char == "'" || char == '"'){
            
            if(stack.isEmpty()) {
                stack.push(char) // stack: 
            }else{
                if(stack.peek() == char){
                    str+=char //
                    fixedJson += str.replace(/"/g, '\\"').replace(/'/g, '"') // {"type": "text", "text": "hey"
                    str="" //
                    stack.pop() //stack: 
                    continue;
                }
            }
        }
        str += char //str: 
        console.log(str)
    }
    if (str) fixedJson += str
    return `${fixedJson}`
}

console.log(text)
const fixedText = await fixText(text)
console.log(JSON.parse(fixedText))