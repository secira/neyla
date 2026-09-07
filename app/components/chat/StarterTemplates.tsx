import React from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';

interface FrameworkLinkProps {
  template: Template;
}

const isValidGithubRepo = (repo: string) => /^[\w.-]+\/[\w.-]+$/.test(repo);

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template }) => {
  const validRepo = isValidGithubRepo(template.githubRepo);
  const content = (
    <>
      <div
        className={`inline-block ${template.icon} w-7 h-7 transition-all grayscale group-hover:grayscale-0 group-hover:scale-110 opacity-60 group-hover:opacity-100`}
        style={{ transition: 'all 0.2s ease' }}
      />
      <span className="text-[9px] text-bolt-elements-textSecondary transition-colors">{template.label}</span>
      <span className="max-w-24 text-center text-[9px] leading-tight text-bolt-elements-textTertiary">
        {validRepo ? template.description : 'Template currently unavailable'}
      </span>
    </>
  );

  if (!validRepo) {
    return (
      <div
        className="flex max-w-28 flex-col items-center justify-center gap-1 opacity-60"
        aria-label={`${template.label} is currently unavailable`}
      >
        {content}
      </div>
    );
  }

  return (
    <a
      href={`/git?url=${encodeURIComponent(`https://github.com/${template.githubRepo}.git`)}`}
      data-state="closed"
      data-discover="true"
      className="group flex max-w-28 flex-col items-center justify-center gap-1"
      title={template.description}
      aria-label={`${template.label}: ${template.description}`}
    >
      {content}
    </a>
  );
};

const StarterTemplates: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-3 pb-6">
      <div className="flex items-center gap-3 text-xs text-bolt-elements-textTertiary">
        <div className="h-px w-12 bg-bolt-elements-borderColor" />
        <span>or start with a template</span>
        <div className="h-px w-12 bg-bolt-elements-borderColor" />
      </div>
      <div className="flex flex-wrap justify-center items-center gap-5 max-w-sm">
        {STARTER_TEMPLATES.map((template) => (
          <FrameworkLink key={template.name} template={template} />
        ))}
      </div>

      {/* Social proof / trust signal */}
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <div className="flex -space-x-2">
          {['🧑‍💻', '👩‍💻', '👨‍💻', '🧕', '👦'].map((emoji, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 bg-gradient-to-br flex items-center justify-center text-sm"
              style={{
                background: `hsl(${i * 40 + 20}, 70%, 85%)`,
                zIndex: 5 - i,
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
        <p className="text-xs text-bolt-elements-textTertiary text-center">
          <span className="font-semibold text-bolt-elements-textSecondary">1,000+</span> developers building with Neyla today
        </p>
        <p className="text-[10px] text-bolt-elements-textTertiary">
          Tamil · Hindi · Telugu support coming soon 🇮🇳
        </p>
      </div>
    </div>
  );
};

export default StarterTemplates;
