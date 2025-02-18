class VoiceAssistant {
    constructor() {
        this.micButton = document.getElementById('micButton');
        this.sendButton = document.getElementById('sendButton');
        this.userInput = document.getElementById('userInput');
        this.chatMessages = document.getElementById('chatMessages');
        
        // Check if browser supports speech recognition
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
            this.recognition = null;
        }

        // Configure speech recognition
        if (this.recognition) {
            this.recognition.lang = 'en-US';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
        }
        
        // Initialize speech synthesis with error handling
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
            // Load voices when they are ready
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => {
                    this.voices = this.synthesis.getVoices();
                };
            }
        } else {
            console.warn('Speech synthesis not supported');
            this.synthesis = null;
        }
        
        this.isListening = false;
        
        // Add API key configuration
        this.apiKey = 'YOUR_OPENAI_API_KEY'; // Replace with your actual API key
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        
        // Initialize welcome section
        this.welcomeSection = document.querySelector('.welcome-section');
        this.optionsSection = document.querySelector('.options');
        
        // Update API URLs to use the correct server port (3001)
        this.erpApiUrl = 'http://localhost:3001/api/erp';  // Changed from 5500 to 3001
        this.geminiApiUrl = 'http://localhost:3001/api/gemini';
        
        // Initialize ERP config
        this.moduleConfigs = {
            erp: {
                DBName: 'ERPCommonDB',  // Make sure this matches your database name
                Version: 'Gemini'
            },
            gemini: {
                // Gemini specific settings if needed
            },
            openai: {
                // OpenAI specific settings
            },
            deepseek: {
                // DeepSeek specific settings
            }
        };
        
        this.initializeUI();
        this.initializeSettings();
        this.initializeModals();
    }

    initializeUI() {
        // Make sure chat messages container is visible
        this.chatMessages.style.display = 'flex';
        this.chatMessages.style.flexDirection = 'column';
        this.chatMessages.style.gap = '1rem';
        this.chatMessages.style.minHeight = '200px';
        
        // Initialize all buttons
        this.initializeOptionButtons();
        this.initializeMicButton();
        this.initializeSendButton();
        this.initializeInputField();

        // Make sure welcome and options are visible initially
        if (this.welcomeSection) {
            this.welcomeSection.style.display = 'block';
        }
        if (this.optionsSection) {
            this.optionsSection.style.display = 'grid';
        }
    }

    initializeOptionButtons() {
        const optionButtons = document.querySelectorAll('.option-btn');
        optionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                const buttonText = button.textContent.trim();
                console.log('Option button clicked:', action);
                
                let message = '';
                switch(action) {
                    case 'create-image':
                        message = 'Create an image of';
                        break;
                    case 'get-advice':
                        message = 'I need advice about';
                        break;
                    case 'brainstorm':
                        message = 'Let\'s brainstorm about';
                        break;
                    case 'code':
                        message = 'Help me code';
                        break;
                    case 'erp-query':
                        message = 'Show me the total sales company wise';
                        break;
                    default:
                        message = `Help me ${buttonText.toLowerCase()}`;
                }
                
                this.userInput.value = message;
                this.userInput.focus();
            });
        });
    }

    initializeMicButton() {
        if (this.micButton) {
            this.micButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mic button clicked');
                this.toggleVoiceInput();
            });
        }
    }

    initializeSendButton() {
        if (this.sendButton) {
            this.sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Send button clicked');
                this.sendMessage();
            });
        }
    }

    initializeInputField() {
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    console.log('Enter key pressed');
                    this.sendMessage();
                }
            });
        }
    }

    toggleVoiceInput() {
        if (!this.recognition) {
            alert('Speech recognition is not supported in your browser');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
            } catch (error) {
                console.error('Speech recognition error:', error);
                // If recognition is already started, stop it and start again
                this.recognition.stop();
                setTimeout(() => {
                    this.recognition.start();
                    this.isListening = true;
                }, 100);
            }
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.userInput.value = '';
        
        // Hide welcome and options
        if (this.welcomeSection) {
            this.welcomeSection.style.display = 'none';
        }
        if (this.optionsSection) {
            this.optionsSection.style.display = 'none';
        }
        
        this.showTypingIndicator();
        
        try {
            let response;
            // Route to appropriate module
            switch (this.activeModule) {
                case 'erp':
                    response = await this.getERPResponse(message);
                    break;
                case 'gemini':
                    response = await this.getGeminiResponse(message);
                    break;
                case 'copilot':
                    response = await this.getCopilotResponse(message);
                    break;
                case 'deepseek':
                    response = await this.getDeepSeekResponse(message);
                    break;
                default:
                    response = await this.getAIResponse(message);
            }

            this.removeTypingIndicator();
            this.addMessage(response, 'assistant');
            this.speakText(response);
            
        } catch (error) {
            console.error('Error getting response:', error);
            this.removeTypingIndicator();
            this.addMessage('Sorry, there was an error processing your request.', 'assistant');
        }
    }

    async getAIResponse(message) {
        try {
            console.log('Sending request to server...');
            const response = await fetch('http://127.0.0.1:5500/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful assistant that provides detailed, well-structured responses. Format your responses with markdown for better readability."
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Server response error:', errorData);
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            return data.choices[0].message.content;

        } catch (error) {
            console.error('Error calling AI API:', error);
            if (error.message.includes('Failed to fetch')) {
                return "Error: Server is not running. Please start the server with 'node server.js'";
            }
            throw error;
        }
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'assistant-message', 'typing-indicator');
        typingDiv.innerHTML = 'Typing<span>.</span><span>.</span><span>.</span>';
        typingDiv.id = 'typing-indicator';
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    generateResponse(message) {
        message = message.toLowerCase();
        
        // Technology Questions
        if (message.includes('what is') || message.includes('how does') || message.includes('explain')) {
            if (message.includes('javascript') || message.includes('python') || message.includes('programming')) {
                return this.generateTechResponse(message);
            }
        }
        
        // Historical or Factual Questions
        if (message.includes('who') || message.includes('when') || message.includes('where') || message.includes('history')) {
            return this.generateHistoricalResponse(message);
        }
        
        // Scientific Questions
        if (message.includes('why') || message.includes('how') || message.includes('science')) {
            return this.generateScientificResponse(message);
        }

        // Default to general knowledge response
        return this.generateDetailedResponse(message);
    }

    generateTechResponse(message) {
        // Example for JavaScript explanation
        if (message.includes('javascript') || message.includes('js')) {
            return `Let me explain JavaScript in detail:

1. What is JavaScript?
   - JavaScript is a high-level, interpreted programming language
   - It's primarily used for web development
   - Created by Brendan Eich in 1995

2. Key Features:
   - Dynamic typing
   - First-class functions
   - Object-oriented capabilities
   - Event-driven programming

3. Common Uses:
   - Web development
   - Server-side applications (Node.js)
   - Mobile app development
   - Game development

4. Here's a practical example:
\`\`\`javascript
// Example of modern JavaScript features
const calculateArea = (length, width) => {
    return length * width;
};

const shapes = ['square', 'rectangle', 'circle'];
shapes.forEach(shape => {
    console.log(\`Processing \${shape}\`);
});
\`\`\`

5. Best Practices:
   - Use modern ES6+ syntax
   - Follow consistent naming conventions
   - Implement error handling
   - Write clean, maintainable code

Would you like me to elaborate on any of these points or show more examples?`;
        }

        // Add more technology-specific responses here
        return this.generateDetailedResponse(message);
    }

    generateHistoricalResponse(message) {
        return `Let me provide a comprehensive answer about ${message}:

1. Historical Context:
   - Background and origin
   - Key dates and events
   - Important figures involved

2. Significant Developments:
   - Major milestones
   - Critical changes over time
   - Impact on society

3. Modern Relevance:
   - Current implications
   - Contemporary applications
   - Future perspectives

4. Interesting Facts:
   - Lesser-known details
   - Surprising connections
   - Cultural significance

Would you like me to expand on any of these aspects?`;
    }

    generateScientificResponse(message) {
        return `Here's a scientific explanation of ${message}:

1. Basic Principles:
   - Fundamental concepts
   - Core mechanisms
   - Scientific laws involved

2. How It Works:
   - Step-by-step process
   - Key components
   - Underlying mechanisms

3. Real-World Applications:
   - Practical uses
   - Industry applications
   - Everyday examples

4. Scientific Research:
   - Current studies
   - Recent discoveries
   - Future developments

5. Visual Representation:
   [I would include diagrams or formulas if applicable]

Would you like me to delve deeper into any of these aspects?`;
    }

    generateDetailedResponse(message) {
        // Extract key terms from the message
        const terms = message.split(' ').filter(word => word.length > 3);
        
        return `Let me provide a comprehensive answer about "${message}":

1. Overview:
   - Basic definition and context
   - Key concepts involved
   - General importance

2. Detailed Analysis:
   ${terms.map(term => `   - Understanding "${term}"\n`).join('')}
   - Related concepts
   - Important connections

3. Practical Applications:
   - Real-world usage
   - Common scenarios
   - Practical examples

4. Additional Considerations:
   - Best practices
   - Common misconceptions
   - Tips and recommendations

5. Further Learning:
   - Related topics
   - Recommended resources
   - Next steps

Would you like me to elaborate on any particular aspect or provide specific examples?`;
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.classList.add('message-timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();
        messageDiv.appendChild(timestamp);
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content');
        
        // Handle markdown-style formatting including tables
        const formattedText = text
            .split('\n')
            .map(line => {
                // Handle bold text
                if (line.match(/\*\*(.*?)\*\*/)) {
                    return line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                }
                // Handle table rows
                if (line.startsWith('|')) {
                    return line.replace(/\|/g, '</td><td>').replace(/^<\/td>/, '<td>').replace(/<td>$/, '');
                }
                // Handle table headers
                if (line.match(/^\|[\s-]+\|$/)) {
                    return '<tr class="table-divider"><td colspan="100%"></td></tr>';
                }
                // Handle code blocks
                if (line.match(/```/)) {
                    return line.replace(/```(\w+)?/, '<pre><code>').replace(/```/, '</code></pre>');
                }
                return line;
            })
            .join('\n')
            .replace(/<td>([\s-]+)<\/td>/g, '<td></td>') // Clean up divider cells
            .replace(/(<td>.*?<\/td>)+/g, row => `<tr>${row}</tr>`) // Wrap td groups in tr
            .replace(/(<tr>.*?<\/tr>)+/g, rows => `<table class="erp-table">${rows}</table>`); // Wrap tr groups in table

        contentWrapper.innerHTML = formattedText;
        messageDiv.appendChild(contentWrapper);
        
        // Add action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn copy-btn';
        copyBtn.title = 'Copy to clipboard';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.addEventListener('click', () => this.copyToClipboard(text));
        
        // Share button
        const shareBtn = document.createElement('button');
        shareBtn.className = 'action-btn share-btn';
        shareBtn.title = 'Share';
        shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
        shareBtn.addEventListener('click', (e) => this.showShareOptions(e, text));
        
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(shareBtn);
        messageDiv.appendChild(actionsDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    speakText(text) {
        if (!this.synthesis) {
            console.warn('Speech synthesis not available');
            return;
        }

        try {
            // Cancel any ongoing speech
            this.synthesis.cancel();

            // Clean text for speech (remove markdown and code blocks)
            const cleanText = this.cleanTextForSpeech(text);

            // Create utterance with proper configuration
            const utterance = new SpeechSynthesisUtterance(cleanText);
            
            // Configure speech properties
            utterance.lang = 'en-US';
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;

            // Select a voice if available
            if (this.voices && this.voices.length > 0) {
                // Prefer a female English voice
                const voice = this.voices.find(v => 
                    v.lang.includes('en') && v.name.includes('Female')) 
                    || this.voices[0];
                utterance.voice = voice;
            }

            // Add event handlers
            utterance.onstart = () => {
                console.log('Speech started');
            };

            utterance.onend = () => {
                console.log('Speech finished');
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                // Try to recover from error
                this.synthesis.cancel();
            };

            utterance.onpause = () => {
                console.log('Speech paused');
            };

            utterance.onresume = () => {
                console.log('Speech resumed');
            };

            // Speak the text
            this.synthesis.speak(utterance);

        } catch (error) {
            console.error('Error in speech synthesis:', error);
            // Try to recover from error
            this.synthesis.cancel();
        }
    }

    cleanTextForSpeech(text) {
        // Remove code blocks
        text = text.replace(/```[\s\S]*?```/g, 'Here is some code example.');
        
        // Remove markdown formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
        text = text.replace(/\*(.*?)\*/g, '$1');     // Italic
        text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
        text = text.replace(/#{1,6}\s/g, '');        // Headers
        text = text.replace(/`(.*?)`/g, '$1');       // Inline code
        
        // Convert bullet points to natural speech
        text = text.replace(/^\s*[-*]\s/gm, 'bullet point: ');
        
        // Convert numbered lists to natural speech
        text = text.replace(/^\d+\.\s/gm, 'point ');
        
        // Remove excessive newlines
        text = text.replace(/\n{2,}/g, '. ');
        text = text.replace(/\n/g, '. ');
        
        // Remove excessive spaces
        text = text.replace(/\s+/g, ' ');
        
        return text.trim();
    }

    // Add this method to handle speech synthesis errors
    handleSpeechError() {
        if (this.synthesis) {
            this.synthesis.cancel();
            setTimeout(() => {
                // Reset speech synthesis if needed
                this.synthesis = window.speechSynthesis;
            }, 100);
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    initializeSettings() {
        const settingsBtn = document.querySelector('.settings-btn');
        const settingsMenu = document.getElementById('settingsMenu');
        
        // Add menu header to HTML if not present
        if (!settingsMenu.querySelector('.menu-header')) {
            const menuHeader = document.createElement('div');
            menuHeader.className = 'menu-header';
            menuHeader.innerHTML = `
                <h2>Menu</h2>
                <div class="menu-close">×</div>
            `;
            settingsMenu.insertBefore(menuHeader, settingsMenu.firstChild);
        }
        
        // Settings button click
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.add('active');
        });
        
        // Close button click
        const closeBtn = settingsMenu.querySelector('.menu-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                settingsMenu.classList.remove('active');
            });
        }
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsMenu.classList.remove('active');
            }
        });

        // Menu items click handlers
        const menuItems = {
            loginMenuItem: document.getElementById('loginMenuItem'),
            historyMenuItem: document.getElementById('historyMenuItem'),
            settingsMenuItem: document.getElementById('settingsMenuItem'),
            newChatMenuItem: document.getElementById('newChatMenuItem')
        };
        
        Object.entries(menuItems).forEach(([key, element]) => {
            if (element) {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    settingsMenu.classList.remove('active');
                    
                    switch(key) {
                        case 'loginMenuItem':
                            if (this.isLoggedIn) {
                                this.logout();
                            } else {
                                document.getElementById('loginModal').style.display = 'block';
                            }
                            break;
                        case 'historyMenuItem':
                            this.showHistory();
                            break;
                        case 'settingsMenuItem':
                            document.getElementById('settingsModal').style.display = 'block';
                            break;
                        case 'newChatMenuItem':
                            this.startNewChat();
                            break;
                    }
                });
            }
        });

        // Add settings controls
        const darkModeToggle = document.getElementById('darkModeToggle');
        const languageSelect = document.getElementById('languageSelect');
        const voiceToggle = document.getElementById('voiceToggle');
        const speedRange = document.getElementById('speedRange');
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');

        // Load saved settings
        this.loadSettings();

        // Settings event listeners
        darkModeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
            this.saveSettings();
        });

        languageSelect.addEventListener('change', () => {
            this.language = languageSelect.value;
            this.saveSettings();
        });

        voiceToggle.addEventListener('change', () => {
            this.voiceEnabled = voiceToggle.checked;
            this.saveSettings();
        });

        speedRange.addEventListener('input', () => {
            this.responseSpeed = speedRange.value;
            this.saveSettings();
        });

        // Save settings button handler
        saveSettingsBtn.addEventListener('click', () => {
            this.saveSettings();
            document.getElementById('settingsModal').style.display = 'none';
        });

        // Add module selection handling
        const moduleSelect = document.getElementById('moduleSelect');
        const erpSettings = document.getElementById('erpSettings');
        const erpDatabase = document.getElementById('erpDatabase');
        const erpVersion = document.getElementById('erpVersion');

        moduleSelect.addEventListener('change', () => {
            this.activeModule = moduleSelect.value;
            this.updateModuleSettings();
            this.saveSettings();
        });

        // ERP specific settings
        erpDatabase.addEventListener('change', () => {
            this.moduleConfigs.erp.DBName = erpDatabase.value;
            this.saveSettings();
        });

        erpVersion.addEventListener('change', () => {
            this.moduleConfigs.erp.Version = erpVersion.value;
            this.saveSettings();
        });
    }

    updateModuleSettings() {
        const erpSettings = document.getElementById('erpSettings');
        
        // Hide all module-specific settings first
        document.querySelectorAll('.module-settings').forEach(el => {
            el.classList.remove('active');
        });

        // Show settings for selected module
        if (this.activeModule === 'erp') {
            erpSettings.classList.add('active');
        }
    }

    startNewChat() {
        // Clear chat messages
        this.chatMessages.innerHTML = '';
        
        // Show welcome section and options
        if (this.welcomeSection) {
            this.welcomeSection.style.display = 'block';
            this.welcomeSection.style.animation = 'messageAppear 0.3s ease forwards';
        }
        if (this.optionsSection) {
            this.optionsSection.style.display = 'grid';
            this.optionsSection.style.animation = 'messageAppear 0.3s ease forwards';
        }
        
        // Clear input
        this.userInput.value = '';
        
        // Save current chat to history if it has messages
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            history.unshift({
                timestamp: new Date().toISOString(),
                messages: Array.from(messages).map(msg => ({
                    type: msg.classList.contains('user-message') ? 'user' : 'assistant',
                    content: msg.textContent
                }))
            });
            localStorage.setItem('chatHistory', JSON.stringify(history));
        }
    }

    saveSettings() {
        const settings = {
            darkMode: document.body.classList.contains('dark-mode'),
            language: document.getElementById('languageSelect').value,
            voiceEnabled: document.getElementById('voiceToggle').checked,
            responseSpeed: document.getElementById('speedRange').value,
            activeModule: this.activeModule,
            moduleConfigs: this.moduleConfigs
        };
        localStorage.setItem('settings', JSON.stringify(settings));
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').checked = true;
        }
        if (settings.language) {
            this.language = settings.language;
            document.getElementById('languageSelect').value = settings.language;
        }
        if (settings.voiceEnabled !== undefined) {
            this.voiceEnabled = settings.voiceEnabled;
            document.getElementById('voiceToggle').checked = settings.voiceEnabled;
        }
        if (settings.responseSpeed) {
            this.responseSpeed = settings.responseSpeed;
            document.getElementById('speedRange').value = settings.responseSpeed;
        }
        
        if (settings.activeModule) {
            this.activeModule = settings.activeModule;
            document.getElementById('moduleSelect').value = settings.activeModule;
        }
        
        if (settings.moduleConfigs) {
            this.moduleConfigs = settings.moduleConfigs;
            if (settings.moduleConfigs.erp) {
                document.getElementById('erpDatabase').value = settings.moduleConfigs.erp.DBName;
                document.getElementById('erpVersion').value = settings.moduleConfigs.erp.Version;
            }
        }
        
        this.updateModuleSettings();
    }

    async login(email, password) {
        // Implement your login logic here
        this.isLoggedIn = true;
        this.userEmail = email;
        document.getElementById('loginMenuItem').innerHTML = `
            <i class="fas fa-sign-out-alt"></i>
            Logout
        `;
        this.saveUserData();
    }

    logout() {
        this.isLoggedIn = false;
        this.userEmail = null;
        document.getElementById('loginMenuItem').innerHTML = `
            <i class="fas fa-sign-in-alt"></i>
            Login
        `;
        localStorage.removeItem('userData');
    }

    saveUserData() {
        const userData = {
            isLoggedIn: this.isLoggedIn,
            email: this.userEmail
        };
        localStorage.setItem('userData', JSON.stringify(userData));
    }

    showHistory() {
        const historyModal = document.getElementById('historyModal');
        const historyList = document.getElementById('historyList');
        const selectedChatContent = document.getElementById('selectedChatContent');
        
        // Get chat history from localStorage
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        
        // Clear previous history
        historyList.innerHTML = '';
        
        // Add history items
        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            if (index === 0) historyItem.classList.add('active');
            
            const date = new Date(item.timestamp);
            const timeString = date.toLocaleString();
            
            // Safely access the first message content
            const firstMessage = item.message || (item.messages && item.messages[0]?.content) || 'No content';
            
            historyItem.innerHTML = `
                <div class="history-time">${timeString}</div>
                <div class="history-message">${firstMessage}</div>
            `;
            
            // Click handler for history items
            historyItem.addEventListener('click', () => {
                // Remove active class from all items
                document.querySelectorAll('.history-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to clicked item
                historyItem.classList.add('active');
                
                // Show chat content
                selectedChatContent.innerHTML = '';
                
                // Handle both old and new history formats
                if (item.messages) {
                    item.messages.forEach(msg => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = `chat-message ${msg.type}`;
                        messageDiv.innerHTML = `
                            <div class="time">${timeString}</div>
                            <div class="content">${msg.content}</div>
                        `;
                        selectedChatContent.appendChild(messageDiv);
                    });
                } else {
                    // Handle old format
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'chat-message';
                    messageDiv.innerHTML = `
                        <div class="time">${timeString}</div>
                        <div class="content">${item.message || 'No content'}</div>
                    `;
                    selectedChatContent.appendChild(messageDiv);
                }
            });
            
            historyList.appendChild(historyItem);
        });
        
        historyModal.style.display = 'block';
    }

    initializeModals() {
        // Close button functionality
        document.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Switch between login and register
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('registerModal').style.display = 'block';
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerModal').style.display = 'none';
            document.getElementById('loginModal').style.display = 'block';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Handle form submissions
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await this.login(email, password);
            document.getElementById('loginModal').style.display = 'none';
        });

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            await this.register(name, email, password);
            document.getElementById('registerModal').style.display = 'none';
        });
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text:', err);
            this.showToast('Failed to copy text');
        }
    }

    showShareOptions(event, text) {
        // Remove any existing share menus
        document.querySelectorAll('.share-menu').forEach(menu => menu.remove());
        
        const shareMenu = document.createElement('div');
        shareMenu.className = 'share-menu';
        
        const shareOptions = [
            { icon: 'twitter', label: 'Twitter', action: () => this.shareToTwitter(text) },
            { icon: 'facebook', label: 'Facebook', action: () => this.shareToFacebook(text) },
            { icon: 'linkedin', label: 'LinkedIn', action: () => this.shareToLinkedIn(text) },
            { icon: 'envelope', label: 'Email', action: () => this.shareViaEmail(text) }
        ];
        
        shareOptions.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'share-option';
            optionElement.innerHTML = `
                <i class="fab fa-${option.icon}"></i>
                <span>${option.label}</span>
            `;
            optionElement.addEventListener('click', option.action);
            shareMenu.appendChild(optionElement);
        });
        
        // Position the menu
        const rect = event.target.getBoundingClientRect();
        shareMenu.style.top = `${rect.bottom + 5}px`;
        shareMenu.style.left = `${rect.left}px`;
        
        document.body.appendChild(shareMenu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!shareMenu.contains(e.target) && !event.target.contains(e.target)) {
                    shareMenu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
        
        shareMenu.classList.add('active');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }, 100);
    }

    shareToTwitter(text) {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    shareToFacebook(text) {
        const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    shareToLinkedIn(text) {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    shareViaEmail(text) {
        const subject = 'Shared AI Response';
        const body = text;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    // Add new method to handle ERP API calls
    async getERPResponse(question) {
        try {
            const requestData = {
                DBName: 'ERPCommonDB',
                Version: this.moduleConfigs.erp.Version || 'Gemini',
                question: question.trim(),
                outputformat: 'json'
            };

            console.log('Sending ERP request:', requestData);

            const response = await fetch(this.erpApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                console.error('ERP API Error Status:', response.status);
                const errorText = await response.text();
                console.error('ERP API Error Response:', errorText);
                throw new Error(`ERP API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('ERP API response:', data);

            // Format the response
            if (data.status === 'success' && data.Answer) {
                let formattedResponse = '';
                
                if (Array.isArray(data.Answer)) {
                    // Get all unique keys from the response to create table headers
                    const headers = [...new Set(data.Answer.flatMap(obj => Object.keys(obj)))];
                    
                    // Create table header
                    formattedResponse = '| ' + headers.join(' | ') + ' |\n';
                    formattedResponse += '|' + headers.map(() => '---').join('|') + '|\n';
                    
                    // Add table rows
                    data.Answer.forEach(item => {
                        const row = headers.map(header => {
                            let value = item[header] || '';
                            // Format numbers if they contain commas and look like currency
                            if (typeof value === 'string' && value.includes(',') && /^[₹$]?[\d,]+\.?\d*$/.test(value.replace(/[₹$]/g, ''))) {
                                value = value.replace(/^(₹|$)?/, '₹'); // Ensure ₹ symbol
                            }
                            return value.toString().trim() || '-';
                        });
                        formattedResponse += '| ' + row.join(' | ') + ' |\n';
                    });
                    
                    // Add message if available
                    if (data.message) {
                        formattedResponse = `**${data.message}**\n\n${formattedResponse}`;
                    }
                    
                    // Add SQL query if available
                    if (data.sql) {
                        //formattedResponse += `\n**SQL Query:**\n\`\`\`sql\n${data.sql}\n\`\`\``;
                        //no need to display the sql
                    }
                } else {
                    formattedResponse = data.Answer.toString();
                }
                
                return formattedResponse;
            }
            
            return data.message || "No data available for this query.";

        } catch (error) {
            console.error('ERP API Error:', error);
            throw error;
        }
    }

    // Helper method to format numbers with commas and decimals
    formatNumber(number) {
        if (typeof number === 'string') {
            number = parseFloat(number);
        }
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(number);
    }

    // Helper method to determine if a message is an ERP query
    isERPQuery(message) {
        // Add your logic to determine if the message is an ERP query
        const erpKeywords = [
            'sales',
            'company',
            'total',
            'revenue',
            'profit',
            'inventory',
            'stock',
            'customer',
            'vendor',
            'purchase'
        ];

        return erpKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // Add Gemini response handler
    async getGeminiResponse(message) {
        try {
            const response = await fetch(this.geminiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`Gemini API request failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            return data.message;

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error;
        }
    }
}

// Initialize the voice assistant when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.voiceAssistant = new VoiceAssistant();
        console.log('Voice Assistant initialized successfully');
    } catch (error) {
        console.error('Error initializing Voice Assistant:', error);
    }
});

const translations = {
    en: {
        // ... existing translations ...
        erpQuery: "ERP Query"
    },
    hi: {
        // ... existing translations ...
        erpQuery: "ईआरपी क्वेरी"
    },
    or: {
        // ... existing translations ...
        erpQuery: "ଇଆରପି କ୍ୱେରୀ"
    },
    bn: {
        // ... existing translations ...
        erpQuery: "ইআরপি কোয়েরি"
    },
    ur: {
        // ... existing translations ...
        erpQuery: "ای آر پی کوئری"
    }
    // ... add for other languages
}; 