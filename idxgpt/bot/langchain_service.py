"""
LangChain Service for BJB Sekuritas Telegram Bot
Provides integration with LangChain and OpenAI for advanced AI capabilities.
"""

import os
from typing import Optional, List, Dict, Any
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain, ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain.agents import AgentType, initialize_agent, load_tools
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

class LangChainService:
    def __init__(self, openai_api_key: Optional[str] = None):
        """
        Initialize the LangChain service with OpenAI API key.
        If not provided, it will be read from environment variable OPENAI_API_KEY.
        """
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it directly.")
        
        # Initialize the language model
        self.llm = OpenAI(
            openai_api_key=self.openai_api_key,
            temperature=0.7,
            max_tokens=1000
        )
        
        # Initialize the chat model for conversational AI
        self.chat_model = ChatOpenAI(
            openai_api_key=self.openai_api_key,
            temperature=0.7,
            max_tokens=1000
        )
        
        # Memory for conversation context
        self.memory = ConversationBufferMemory()
        
        # Initialize a simple conversation chain
        self.conversation = ConversationChain(
            llm=self.chat_model,
            memory=self.memory,
            verbose=False
        )
    
    def generate_text(self, prompt: str, max_tokens: int = 1000) -> str:
        """
        Generate text using the OpenAI LLM.
        """
        self.llm.max_tokens = max_tokens
        return self.llm(prompt)
    
    def chat(self, message: str) -> str:
        """
        Send a message to the conversation chain and get a response.
        """
        return self.conversation.predict(input=message)
    
    def create_prompt_template(self, template: str, input_variables: List[str]) -> PromptTemplate:
        """
        Create a reusable prompt template.
        """
        return PromptTemplate(
            input_variables=input_variables,
            template=template
        )
    
    def create_llm_chain(self, prompt_template: PromptTemplate) -> LLMChain:
        """
        Create an LLM chain with the given prompt template.
        """
        return LLMChain(
            llm=self.llm,
            prompt=prompt_template,
            verbose=False
        )
    
    def initialize_agent_with_tools(self, tools: List[str] = None, agent_type: AgentType = AgentType.ZERO_SHOT_REACT_DESCRIPTION):
        """
        Initialize an agent with optional tools.
        If no tools are provided, it will load basic tools like 'llm-math' and 'wikipedia'.
        """
        if tools is None:
            tools = load_tools(["llm-math", "wikipedia"], llm=self.llm)
        else:
            tools = load_tools(tools, llm=self.llm)
        
        return initialize_agent(
            tools, 
            self.llm, 
            agent=agent_type, 
            verbose=False,
            handle_parsing_errors=True
        )

# Example usage (for testing purposes)
if __name__ == "__main__":
    # This is just for demonstration; in practice, the service will be used by the bot.
    try:
        service = LangChainService()
        response = service.chat("Hello, how can you assist me with stock analysis today?")
        print(response)
    except Exception as e:
        print(f"Error initializing LangChain service: {e}")