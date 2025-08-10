import { Controller, Post, Body, HttpException, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        try {
            const result = await this.authService.register(registerDto);
            return {
                success: true,
                data: result,
                message: 'User registered successfully',
            };
        } catch (error) {
            console.error('Registration error:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Registration failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        try {
            const result = await this.authService.login(loginDto);
            return {
                success: true,
                data: result,
                message: 'Login successful',
            };
        } catch (error) {
            console.error('Login error:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Login failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req) {
        try {
            const user = await this.authService.validateUser(req.user.userId);
            return {
                success: true,
                data: user,
            };
        } catch (error) {
            console.error('Get profile error:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to get user profile',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
