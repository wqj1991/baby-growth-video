import { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('错误边界捕获到错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-white p-8">
          <h1 className="text-xl font-bold text-red-600 mb-4">页面出错了</h1>
          <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-w-full">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 btn btn-primary"
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
