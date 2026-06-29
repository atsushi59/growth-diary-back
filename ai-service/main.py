import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google import genai
from pydantic import BaseModel, Field

# .env から API キーを読み込む（ホスト直実行用。compose では環境変数で渡す）
load_dotenv()

API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
if not API_KEY:
    # 起動時に明確に落とす（キー未設定のまま動かして分かりにくい失敗にしない）
    raise RuntimeError("GOOGLE_GEMINI_API_KEY が設定されていません")

MODEL = "gemini-2.5-flash"

client = genai.Client(api_key=API_KEY)
app = FastAPI()

# CORS は付けない。ブラウザは直接叩かず、Node(メインAPI)からのみ呼ばれる内部サービスのため。


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Gemini SDK の呼び出しは同期 I/O。同期ハンドラにして FastAPI のスレッドプールで実行させ、
# イベントループをブロックしないようにする。
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=request.message,
        )
    except Exception as error:  # 外部API失敗（レート制限・ネットワーク等）は 502 に丸める
        raise HTTPException(
            status_code=502, detail="AIサービスでエラーが発生しました"
        ) from error

    return ChatResponse(reply=response.text or "")
