#!/usr/bin/env python3
"""
Create FSD (Feature-Sliced Design) folder structure.

Usage:
    python create_fsd_structure.py <project-root> [--slices cart auth user]

Examples:
    python create_fsd_structure.py ./src
    python create_fsd_structure.py ./src --slices cart auth user product
"""

import argparse
import os
from pathlib import Path


FSD_LAYERS = {
    "app": {
        "segments": ["providers", "styles", "config"],
        "files": {
            "index.tsx": '''import React from 'react';
import { Providers } from './providers';

export const App = () => {
  return (
    <Providers>
      {/* Router goes here */}
    </Providers>
  );
};
''',
            "providers/index.tsx": '''import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export const Providers = ({ children }: ProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
''',
            "styles/global.ts": """import { css } from '@emotion/react';

export const globalStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
`;
""",
            "config/env.ts": '''export const env = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;
''',
        },
    },
    "pages": {
        "segments": [],
        "files": {
            ".gitkeep": "",
        },
    },
    "widgets": {
        "segments": [],
        "files": {
            ".gitkeep": "",
        },
    },
    "features": {
        "segments": [],
        "files": {
            ".gitkeep": "",
        },
    },
    "entities": {
        "segments": [],
        "files": {
            ".gitkeep": "",
        },
    },
    "shared": {
        "segments": ["ui", "api", "lib", "config"],
        "files": {
            "ui/index.ts": '''// Shared UI components
// export { Button } from './Button';
// export { Input } from './Input';
// export { Modal } from './Modal';
''',
            "api/axiosClient.ts": '''import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    return Promise.reject(error);
  }
);
''',
            "lib/cn.ts": '''import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
''',
            "lib/formatDate.ts": '''export const formatDate = (
  date: Date | string,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, options);
};

export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
};
''',
            "config/routes.ts": '''export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
''',
            "index.ts": '''export { axiosInstance } from './api/axiosClient';
export { cn } from './lib/cn';
export { formatDate, formatRelativeTime } from './lib/formatDate';
export { ROUTES } from './config/routes';
export type { AppRoute } from './config/routes';
''',
        },
    },
}

SLICE_SEGMENTS = ["ui", "api", "model", "lib", "config"]


def create_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def create_file(path: Path, content: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_slice(base_path: Path, slice_name: str) -> None:
    slice_path = base_path / slice_name

    for segment in SLICE_SEGMENTS:
        segment_path = slice_path / segment
        create_directory(segment_path)
        create_file(segment_path / ".gitkeep", "")

    index_content = f'''// {slice_name} public API
// export {{ }} from './ui';
// export {{ }} from './api';
// export type {{ }} from './model';
'''
    create_file(slice_path / "index.ts", index_content)


def create_fsd_structure(project_root: str, slices: list[str] | None = None) -> None:
    root = Path(project_root)

    print(f"Creating FSD structure in: {root.absolute()}")

    for layer_name, layer_config in FSD_LAYERS.items():
        layer_path = root / layer_name
        create_directory(layer_path)

        for segment in layer_config["segments"]:
            create_directory(layer_path / segment)

        for file_path, content in layer_config["files"].items():
            create_file(layer_path / file_path, content)

        print(f"  Created: {layer_name}/")

    if slices:
        features_path = root / "features"
        for slice_name in slices:
            create_slice(features_path, slice_name)
            print(f"  Created: features/{slice_name}/")

    print("\nFSD structure created successfully!")
    print("\nNext steps:")
    print("  1. Install dependencies: npm install axios @tanstack/react-query zustand")
    print("  2. Install dev dependencies: npm install -D @emotion/react @emotion/styled")
    print("  3. Create components using: python create_component.py")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create FSD folder structure for React project"
    )
    parser.add_argument("project_root", help="Project root directory (e.g., ./src)")
    parser.add_argument(
        "--slices",
        nargs="*",
        help="Feature slices to create (e.g., --slices cart auth user)",
    )

    args = parser.parse_args()
    create_fsd_structure(args.project_root, args.slices)


if __name__ == "__main__":
    main()
