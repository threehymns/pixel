
import React from 'react';
import { Plus, Upload, File, Github } from 'lucide-react';
import { INITIAL_STATE } from '../constants';

interface HomeProps {
    onCreateProject: () => void;
    onImportProject: () => void;
}

export const Home: React.FC<HomeProps> = ({ onCreateProject, onImportProject }) => {
    return (
        <div className="flex-1 bg-background flex flex-col items-center justify-center text-foreground select-none">
            <div className="max-w-2xl w-full p-8 flex flex-col gap-8">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg flex items-center justify-center text-white">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                            <path d="M4 4h4v4H4zm4 4h4v4H8zm4 4h4v4h-4zm4 4h4v4h-4z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">PixelForge Studio</h1>
                        <p className="text-muted-foreground text-lg">Professional pixel art editor for the web.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                    <button 
                        onClick={onCreateProject}
                        className="flex flex-col items-center justify-center gap-4 p-8 bg-card border border-border rounded-xl hover:bg-accent hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                            <Plus size={24} />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-foreground mb-1">New Project</h3>
                            <p className="text-sm text-muted-foreground">Start a blank canvas ({INITIAL_STATE.width}x{INITIAL_STATE.height})</p>
                        </div>
                    </button>

                    <button 
                        onClick={onImportProject}
                        className="flex flex-col items-center justify-center gap-4 p-8 bg-card border border-border rounded-xl hover:bg-accent hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Upload size={24} />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-foreground mb-1">Open Project</h3>
                            <p className="text-sm text-muted-foreground">Import .json, .png, or .jpg</p>
                        </div>
                    </button>
                </div>

                <div className="flex flex-col gap-4 mt-8">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-muted-foreground">RECENT PROJECTS</span>
                        <button className="text-primary hover:text-primary/80">Clear</button>
                    </div>
                    <div className="bg-muted border border-border rounded-lg overflow-hidden">
                        <div className="p-8 text-center text-muted-foreground italic">
                            No recent projects found
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-8 flex justify-center gap-6 text-sm text-muted-foreground">
                    <a href="#" className="hover:text-foreground flex items-center gap-2">
                        <File size={14} /> Documentation
                    </a>
                    <a href="#" className="hover:text-foreground flex items-center gap-2">
                        <Github size={14} /> GitHub
                    </a>
                </div>
            </div>
        </div>
    );
};
