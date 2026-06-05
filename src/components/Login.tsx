import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { TrendingUp, LogIn, CheckCircle, AlertCircle } from "lucide-react";

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      
      const email = res.user.email;
      if (email !== "uppseekers@gmail.com") {
        const docRef = doc(db, "invites", email || "invalid");
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await auth.signOut();
          setError("Access Denied. Your account has not been authorized. Contact uppseekers@gmail.com for access.");
          setLoading(false);
          return;
        }
      }

      setSuccess("Signed in successfully! Loading dashboard...");
    } catch (err: any) {
      console.error("Auth action failure:", err);
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] mb-4 animate-pulse">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-50">
          Financial Control Room
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          P&L, client closures database, and interactive AI dash.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0f172a] py-8 px-6 shadow-2xl border border-[#1e293b] rounded-2xl sm:px-10 search-glow hover:border-blue-500/50">
          
          <div className="text-center mb-6">
            <h3 className="text-slate-200 font-semibold mb-2">Secure Connection</h3>
            <p className="text-sm text-slate-400">
              Please use your Google account to access your financial dashboard securely.
            </p>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-950/45 p-3.5 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-200 font-medium">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-950/45 p-3.5 border border-green-900/50 flex items-start gap-2.5 text-xs text-green-200 font-medium">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.15)] text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-tight uppercase">
              Zero-Trust Secure Database Connection Provided by active Firestore blueprints.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

