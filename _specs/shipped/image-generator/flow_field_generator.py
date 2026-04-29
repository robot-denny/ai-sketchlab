#!/usr/bin/env python3
"""
Flow Field Art Generator
Uses article metadata to generate unique organic flow patterns
"""

import numpy as np
from PIL import Image, ImageDraw
import hashlib
from datetime import datetime


class SimpleNoise:
    """Simple gradient noise implementation"""
    def __init__(self, seed=0):
        np.random.seed(seed)
        self.perm = np.random.permutation(256)
        
    def fade(self, t):
        """Smoothstep function"""
        return t * t * (3 - 2 * t)
    
    def lerp(self, a, b, t):
        """Linear interpolation"""
        return a + t * (b - a)
    
    def gradient(self, hash_val, x, y):
        """Calculate gradient"""
        h = hash_val & 3
        u = x if h < 2 else y
        v = y if h < 2 else x
        return (u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v)
    
    def noise(self, x, y):
        """Generate 2D noise value"""
        # Grid cell coordinates
        xi = int(np.floor(x)) & 255
        yi = int(np.floor(y)) & 255
        
        # Relative coordinates in cell
        xf = x - np.floor(x)
        yf = y - np.floor(y)
        
        # Fade curves
        u = self.fade(xf)
        v = self.fade(yf)
        
        # Hash coordinates of 4 corners
        a = self.perm[xi] + yi
        aa = self.perm[a & 255]
        ab = self.perm[(a + 1) & 255]
        b = self.perm[(xi + 1) & 255] + yi
        ba = self.perm[b & 255]
        bb = self.perm[(b + 1) & 255]
        
        # Interpolate gradients
        x1 = self.lerp(self.gradient(aa, xf, yf), self.gradient(ba, xf - 1, yf), u)
        x2 = self.lerp(self.gradient(ab, xf, yf - 1), self.gradient(bb, xf - 1, yf - 1), u)
        
        return self.lerp(x1, x2, v)

class FlowFieldGenerator:
    def __init__(self, width=1200, height=630):
        self.width = width
        self.height = height
        self.flow_field = None
        self.particles = []
        
    def generate_flow_field(self, seed, scale=0.005, octaves=4):
        """Generate noise-based flow field"""
        noise_gen = SimpleNoise(seed)
        self.flow_field = np.zeros((self.height, self.width))
        
        for y in range(self.height):
            for x in range(self.width):
                # Generate angle from noise with multiple octaves
                noise_val = 0
                amplitude = 1.0
                frequency = 1.0
                
                for _ in range(octaves):
                    noise_val += noise_gen.noise(x * scale * frequency, y * scale * frequency) * amplitude
                    amplitude *= 0.5
                    frequency *= 2
                
                # Normalize and convert to angle (0 to 2π)
                noise_val = np.clip(noise_val, -1, 1)
                self.flow_field[y, x] = (noise_val + 1) * np.pi
    
    def spawn_particles(self, num_particles, seed):
        """Spawn particles at random positions"""
        np.random.seed(seed)
        self.particles = []
        
        for _ in range(num_particles):
            x = np.random.uniform(0, self.width)
            y = np.random.uniform(0, self.height)
            self.particles.append({
                'x': x,
                'y': y,
                'history': [(x, y)],
                'alive': True
            })
    
    def update_particles(self, max_steps=200, step_length=2.0):
        """Move particles through the flow field"""
        for particle in self.particles:
            if not particle['alive']:
                continue
            
            for _ in range(max_steps):
                x, y = particle['x'], particle['y']
                
                # Check bounds
                if x < 0 or x >= self.width or y < 0 or y >= self.height:
                    particle['alive'] = False
                    break
                
                # Get flow direction from field
                grid_x = int(x)
                grid_y = int(y)
                
                if 0 <= grid_y < self.height and 0 <= grid_x < self.width:
                    angle = self.flow_field[grid_y, grid_x]
                    
                    # Move particle in flow direction
                    new_x = x + np.cos(angle) * step_length
                    new_y = y + np.sin(angle) * step_length
                    
                    particle['x'] = new_x
                    particle['y'] = new_y
                    particle['history'].append((new_x, new_y))
                else:
                    particle['alive'] = False
                    break
    
    def render(self, color_palette, background_color=(15, 20, 30), line_width=1.5, alpha=180):
        """Render particle trails to image"""
        img = Image.new('RGBA', (self.width, self.height), background_color + (255,))
        draw = ImageDraw.Draw(img, 'RGBA')
        
        # Draw each particle's trail
        for i, particle in enumerate(self.particles):
            if len(particle['history']) < 2:
                continue
            
            # Choose color from palette (cycle through)
            color = color_palette[i % len(color_palette)]
            color_with_alpha = color + (alpha,)
            
            # Draw the trail as a series of lines
            for j in range(len(particle['history']) - 1):
                x1, y1 = particle['history'][j]
                x2, y2 = particle['history'][j + 1]
                
                # Vary alpha along the trail (fade toward end)
                trail_alpha = int(alpha * (j / len(particle['history'])))
                trail_color = color + (max(20, trail_alpha),)
                
                draw.line([(x1, y1), (x2, y2)], fill=trail_color, width=int(line_width))
        
        return img.convert('RGB')


def string_to_seed(s):
    """Convert string to integer seed"""
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % (2**31)


def generate_flow_field_image(article_data, output_path):
    """
    Generate unique flow field image for an article
    
    article_data should contain:
    - node_id: Umbraco node ID
    - title: Article title
    - word_count: Number of words
    - published_date: ISO timestamp
    - categories: List of category names
    """
    
    # Determine color palette based on categories
    color_palettes = {
        'AI & Machine Learning': [
            (0, 140, 200),    # Cyan
            (20, 180, 220),   # Light cyan
            (0, 100, 180),    # Deep blue
        ],
        'Ethics of AI': [
            (220, 100, 60),   # Coral
            (240, 140, 80),   # Orange
            (200, 80, 40),    # Deep orange
        ],
        'Sustainability': [
            (40, 180, 100),   # Green
            (60, 200, 120),   # Light green
            (20, 140, 80),    # Deep green
        ],
        'Vibe Coding': [
            (160, 80, 180),   # Purple
            (200, 120, 200),  # Light purple
            (120, 40, 140),   # Deep purple
        ],
    }
    
    # Get palette or default
    palette = [(0, 140, 200), (20, 180, 220), (0, 100, 180)]  # Default cyan
    if 'categories' in article_data and article_data['categories']:
        for category in article_data['categories']:
            if category in color_palettes:
                palette = color_palettes[category]
                break
    
    # Create generator
    generator = FlowFieldGenerator(width=1200, height=630)
    
    # Generate flow field seeded by title
    title_seed = string_to_seed(article_data.get('title', 'default'))
    
    # Scale based on word count (longer articles = more detailed field)
    scale = 0.003 if article_data.get('word_count', 500) > 800 else 0.005
    
    generator.generate_flow_field(seed=title_seed, scale=scale, octaves=4)
    
    # Spawn particles based on word count and node ID
    node_seed = article_data.get('node_id', 1234)
    num_particles = min(300, max(100, article_data.get('word_count', 500) // 3))
    
    generator.spawn_particles(num_particles, seed=node_seed)
    
    # Update particles through flow field
    # Longer articles = longer trails
    max_steps = min(250, max(150, article_data.get('word_count', 500) // 3))
    generator.update_particles(max_steps=max_steps, step_length=2.5)
    
    # Render with color palette
    img = generator.render(
        color_palette=palette,
        background_color=(15, 20, 30),
        line_width=2.0,
        alpha=160
    )
    
    # Save
    img.save(output_path)
    print(f"Generated flow field image saved to: {output_path}")
    
    return img


if __name__ == "__main__":
    # Test with example article data
    test_article = {
        'node_id': 1234,
        'title': 'Retaining Humanity in AI-Generated Content',
        'word_count': 650,
        'published_date': '2026-02-15T10:30:00Z',
        'categories': ['AI & Machine Learning', 'Ethics of AI']
    }
    
    generate_flow_field_image(test_article, '/home/claude/flow_field_test.png')
