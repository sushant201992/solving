# Pages Directory

## BlogArticle.js
Standalone blog article page component for displaying full-length career growth articles.

### Props
- `onBack` (function): Callback to navigate back to home
- `dark` (boolean): Theme mode (default: true)

### Features
- Responsive mobile-first design
- Dark/Light theme support
- Article with sections, dates, tags
- Back navigation
- Smooth animations
- Professional typography

### Usage Example
```jsx
import BlogArticle from './pages/BlogArticle';

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  
  if (currentPage === "article") {
    return <BlogArticle onBack={() => setCurrentPage("home")} dark={true} />;
  }
  
  return <YourMainComponent />;
}
```

### Article Structure
Each article should follow this structure in the component:

```javascript
const article = {
  title: "Article Title",
  subtitle: "Subtitle or tagline",
  date: "Month Day, Year",
  tag: "Category",
  thumbnail: "/path/to/image.png",
  sections: [
    {
      number: 1,
      title: "SECTION TITLE",
      content: "Detailed content paragraph..."
    },
    // ... more sections
  ]
};
```

### Styling
- Uses CSS-in-JS with inline styles
- Inherits theme colors from parent (DARK/LIGHT tokens)
- Responsive breakpoint: max-width 480px
- Supports RGB animated border cards
