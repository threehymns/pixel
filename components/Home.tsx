
import React from 'react';
import { Plus, File, Github, FolderOpen, Image as ImageIcon, Settings, History } from 'lucide-react';

interface HomeProps {
    onCreateProject: () => void;
    onImportProject: () => void;
}

export const Home: React.FC<HomeProps> = ({ onCreateProject, onImportProject }) => {
    return (
        <div className="flex-1 bg-background flex items-center justify-center text-foreground select-none h-full p-4 md:p-8">
            <div className="max-w-4xl w-full flex flex-col md:flex-row bg-card border border-border rounded-2xl shadow-2xl overflow-hidden h-full md:h-[600px]">
                {/* Left Sidebar / Branding */}
                <div className="w-full md:w-1/3 bg-muted/30 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-border">
                    <div className="flex items-center gap-3 mb-8 md:mb-12">
                        <div className="w-10 h-10 bg-primary rounded-lg shadow-sm flex items-center justify-center text-primary-foreground">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M4 4h4v4H4zm4 4h4v4H8zm4 4h4v4h-4zm4 4h4v4h-4z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">PixelForge</h1>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Studio</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 mb-8 md:mb-0 md:flex-1">
                        <button 
                            onClick={onCreateProject}
                            className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm"
                        >
                            <Plus size={18} />
                            New Project
                        </button>
                        <button 
                            onClick={onImportProject}
                            className="flex items-center gap-3 px-4 py-3 bg-transparent text-foreground hover:bg-accent rounded-lg transition-colors font-medium text-sm"
                        >
                            <FolderOpen size={18} />
                            Open Project...
                        </button>
                    </div>

                    <div className="hidden md:flex flex-col gap-2 text-sm text-muted-foreground mt-auto">
                        <a href="#" className="flex items-center gap-3 px-4 py-2 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                            <File size={16} /> Documentation
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                            <Github size={16} /> GitHub
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                            <Settings size={16} /> Settings
                        </a>
                    </div>
                </div>

                {/* Right Content / Recent Files */}
                <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col bg-card flex-1">
                    <div className="flex items-center gap-2 mb-6 text-muted-foreground">
                        <History size={18} />
                        <h2 className="text-sm font-semibold tracking-wide uppercase">Recent Files</h2>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-xl bg-muted/10 p-6">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                            <ImageIcon size={32} opacity={0.5} />
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-1">No recent projects</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            Create a new project or open an existing file to get started.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={onCreateProject}
                                className="px-4 py-2 bg-accent text-foreground hover:bg-accent/80 rounded-md text-sm font-medium transition-colors"
                            >
                                Create New
                            </button>
                            <button 
                                onClick={onImportProject}
                                className="px-4 py-2 bg-accent text-foreground hover:bg-accent/80 rounded-md text-sm font-medium transition-colors"
                            >
                                Browse Files
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
