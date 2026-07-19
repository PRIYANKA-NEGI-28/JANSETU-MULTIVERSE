from llama_cpp import Llama

llm = Llama(
    model_path=r"C:\Users\qcwor\Desktop\JanSetu-MultiVerse\JANSETU-MULTIVERSE\jansetu-backend\ai\models\qwen\Qwen3-0.6B-Q4_0.gguf",
    verbose=True,
)

print("Qwen GGUF Model Loaded Successfully!")