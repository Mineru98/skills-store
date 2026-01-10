# Tailwind Animation Guide

Patterns for micro-interactions and animations.

## Built-in Animations

```html
<!-- Spin -->
<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">...</svg>

<!-- Ping (notification dot) -->
<span class="relative flex h-3 w-3">
  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
  <span class="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
</span>

<!-- Pulse (skeleton loading) -->
<div class="animate-pulse bg-gray-200 rounded h-4 w-3/4"></div>

<!-- Bounce -->
<div class="animate-bounce">↓</div>
```

## Transition Utilities

```html
<!-- Basic transition -->
<button class="transition duration-200 ease-in-out">Click</button>

<!-- Specific properties -->
<div class="transition-colors duration-300">Color change</div>
<div class="transition-opacity duration-200">Fade</div>
<div class="transition-transform duration-150">Transform</div>
<div class="transition-all duration-300">All properties</div>

<!-- Timing functions -->
<div class="ease-linear">Linear</div>
<div class="ease-in">Ease in</div>
<div class="ease-out">Ease out</div>
<div class="ease-in-out">Ease in-out</div>

<!-- Delay -->
<div class="delay-75">75ms delay</div>
<div class="delay-100">100ms delay</div>
<div class="delay-150">150ms delay</div>
```

## Hover Effects

### Scale

```html
<!-- Subtle scale -->
<button class="transform transition-transform duration-200 
               hover:scale-105 active:scale-95">
  Click me
</button>

<!-- Card hover -->
<div class="transform transition-all duration-300 
            hover:scale-105 hover:shadow-xl">
  Card content
</div>
```

### Color Transitions

```html
<!-- Background color -->
<button class="bg-blue-500 hover:bg-blue-600 
               transition-colors duration-200">
  Button
</button>

<!-- Border color -->
<div class="border-2 border-gray-200 hover:border-blue-500 
            transition-colors duration-200">
  Box
</div>

<!-- Text color -->
<a class="text-gray-600 hover:text-blue-500 
          transition-colors duration-200">
  Link
</a>
```

### Translation

```html
<!-- Lift on hover -->
<div class="transform transition-transform duration-200 
            hover:-translate-y-1">
  Lifts up
</div>

<!-- Slide reveal -->
<div class="group">
  <span class="transform transition-transform duration-200 
               group-hover:translate-x-1">
    → Arrow slides
  </span>
</div>
```

## Group Hover Patterns

```html
<!-- Card with multiple animated elements -->
<div class="group cursor-pointer">
  <div class="bg-white rounded-lg shadow-md p-4
              transition-all duration-300
              group-hover:shadow-xl group-hover:scale-105">
    
    <h3 class="text-gray-900 transition-colors duration-200
               group-hover:text-blue-600">
      Title
    </h3>
    
    <p class="text-gray-500 transition-opacity duration-200
              group-hover:opacity-100 opacity-75">
      Description
    </p>
    
    <span class="text-blue-500 transform transition-transform duration-200
                 group-hover:translate-x-2">
      Learn more →
    </span>
  </div>
</div>
```

## Focus States

```html
<!-- Input focus -->
<input class="border-2 border-gray-200 rounded-lg px-4 py-2
              transition-all duration-200
              focus:border-blue-500 focus:ring-2 focus:ring-blue-200
              focus:outline-none" />

<!-- Button focus -->
<button class="bg-blue-500 text-white px-4 py-2 rounded
               transition-all duration-200
               focus:ring-2 focus:ring-blue-300 focus:ring-offset-2
               focus:outline-none">
  Button
</button>
```

## Staggered Animations

```html
<!-- Staggered list items -->
<ul class="space-y-2">
  <li class="opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]" 
      style="animation-delay: 0ms">Item 1</li>
  <li class="opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]" 
      style="animation-delay: 100ms">Item 2</li>
  <li class="opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]" 
      style="animation-delay: 200ms">Item 3</li>
</ul>

<!-- Using Tailwind delay classes -->
<div class="flex gap-2">
  <div class="animate-fade-in delay-0">First</div>
  <div class="animate-fade-in delay-75">Second</div>
  <div class="animate-fade-in delay-150">Third</div>
</div>
```

## Loading States

```html
<!-- Skeleton loader -->
<div class="space-y-3">
  <div class="animate-pulse bg-gray-200 rounded h-4 w-3/4"></div>
  <div class="animate-pulse bg-gray-200 rounded h-4 w-full"></div>
  <div class="animate-pulse bg-gray-200 rounded h-4 w-2/4"></div>
</div>

<!-- Spinner with text -->
<div class="flex items-center gap-2">
  <svg class="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" 
            stroke="currentColor" stroke-width="4" fill="none"></circle>
    <path class="opacity-75" fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <span>Loading...</span>
</div>

<!-- Button loading state -->
<button class="bg-blue-500 text-white px-4 py-2 rounded
               flex items-center gap-2 disabled:opacity-50"
        disabled>
  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">...</svg>
  Processing...
</button>
```

## Modal/Dialog Animations

```html
<!-- Backdrop fade -->
<div class="fixed inset-0 bg-black/50 
            transition-opacity duration-300
            opacity-0 data-[state=open]:opacity-100">
</div>

<!-- Modal slide + fade -->
<div class="fixed inset-0 flex items-center justify-center p-4">
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full
              transform transition-all duration-300
              opacity-0 scale-95 translate-y-4
              data-[state=open]:opacity-100 
              data-[state=open]:scale-100 
              data-[state=open]:translate-y-0">
    Modal content
  </div>
</div>
```

## Toast Notifications

```html
<!-- Slide in from right -->
<div class="fixed top-4 right-4">
  <div class="bg-white rounded-lg shadow-lg p-4
              transform transition-all duration-300
              translate-x-full opacity-0
              data-[state=visible]:translate-x-0 
              data-[state=visible]:opacity-100">
    Toast message
  </div>
</div>

<!-- Slide up from bottom -->
<div class="fixed bottom-4 left-1/2 -translate-x-1/2">
  <div class="bg-gray-900 text-white rounded-lg px-4 py-2
              transform transition-all duration-300
              translate-y-full opacity-0
              data-[state=visible]:translate-y-0 
              data-[state=visible]:opacity-100">
    Saved successfully
  </div>
</div>
```

## Accessibility: Reduced Motion

```html
<!-- Disable animation for users who prefer reduced motion -->
<button class="transform transition-transform duration-200 
               hover:scale-105
               motion-reduce:transform-none 
               motion-reduce:transition-none">
  Accessible button
</button>

<!-- Only animate if motion is OK -->
<div class="motion-safe:animate-bounce">
  Only bounces if user allows motion
</div>
```

## Custom Keyframes (tailwind.config.js)

```javascript
module.exports = {
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
    },
  },
}
```

## Performance Tips

### DO
- Use `transform` and `opacity` (GPU accelerated)
- Keep durations short (150-300ms for UI)
- Add `will-change` for frequently animated elements
- Use `transition-[specific-property]` over `transition-all`

### DON'T
- Animate `width`, `height`, `top`, `left` (causes layout shifts)
- Use very long animations (>500ms feels slow)
- Animate too many elements simultaneously
- Forget `motion-reduce` for accessibility

## Quick Reference

| Effect | Classes |
|--------|---------|
| Fade in | `opacity-0 hover:opacity-100 transition-opacity` |
| Scale up | `hover:scale-105 transition-transform` |
| Lift | `hover:-translate-y-1 transition-transform` |
| Color | `hover:bg-blue-600 transition-colors` |
| Shadow | `hover:shadow-xl transition-shadow` |
| All | `hover:scale-105 hover:shadow-xl transition-all` |
