import React from 'react';

const EXAMPLE_PROMPTS = [
  {
    text: 'Build a website for my tiffin service with a menu, WhatsApp button, and order form',
    icon: 'i-ph:fork-knife-duotone',
  },
  {
    text: 'Create a portfolio for my design studio with work samples and a contact form',
    icon: 'i-ph:palette-duotone',
  },
  { text: 'Make a wedding invitation page with event details, RSVP form, and map', icon: 'i-ph:heart-duotone' },
  { text: 'Build a product catalog for my saree business with enquiry buttons', icon: 'i-ph:shopping-bag-duotone' },
  { text: 'Create a coaching class website with courses, timetable, and enquiry form', icon: 'i-ph:student-duotone' },
  { text: 'Make a festival greeting page I can share with family on WhatsApp', icon: 'i-ph:confetti-duotone' },
];

const CATEGORIES = [
  { label: 'Business Website', icon: 'i-ph:storefront-duotone' },
  { label: 'Portfolio', icon: 'i-ph:user-circle-duotone' },
  { label: 'Online Store', icon: 'i-ph:shopping-bag-duotone' },
  { label: 'Event Page', icon: 'i-ph:calendar-heart-duotone' },
  { label: 'Mobile App', icon: 'i-ph:device-mobile-duotone' },
  { label: 'Dashboard', icon: 'i-ph:chart-bar-duotone' },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="flex flex-col gap-6 w-full max-w-3xl mx-auto px-4 mt-4">
      {/* Category chips */}
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{ animation: '.3s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards' }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={(event) => {
              sendMessage?.(event, `Create a ${cat.label.toLowerCase()} for me`);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-bolt-elements-borderColor bg-white dark:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-orange-400 hover:shadow-sm transition-all"
          >
            <span className={`${cat.icon} text-sm`} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Example prompt chips */}
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{ animation: '.4s ease-out 0.05s 1 _fade-and-move-in_g2ptj_1 both' }}
      >
        {EXAMPLE_PROMPTS.map((prompt, index) => (
          <button
            key={index}
            onClick={(event) => {
              sendMessage?.(event, prompt.text);
            }}
            className="flex items-center gap-1.5 border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-white dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-all hover:border-orange-300 hover:shadow-sm"
          >
            <span className={`${prompt.icon} text-sm`} style={{ color: '#FF6B2B' }} />
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
}
